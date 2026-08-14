package app.geniusfiles.mobile

import android.Manifest
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.location.LocationManager
import android.net.wifi.WifiManager
import android.net.wifi.p2p.WifiP2pConfig
import android.net.wifi.p2p.WifiP2pDevice
import android.net.wifi.p2p.WifiP2pInfo
import android.net.wifi.p2p.WifiP2pManager
import android.net.wifi.p2p.nsd.WifiP2pDnsSdServiceInfo
import android.net.wifi.p2p.nsd.WifiP2pDnsSdServiceRequest
import android.os.Build
import android.os.Handler
import android.os.Looper
import java.util.concurrent.ConcurrentHashMap

/**
 * Liaison locale directe entre deux appareils — Wi-Fi Direct (Wi-Fi P2P).
 *
 * C'est cette couche qui supprime la dépendance à un réseau Wi-Fi commun :
 * les deux téléphones créent eux-mêmes leur propre groupe Wi-Fi P2P (chiffré
 * WPA2 au niveau lien), sans routeur, sans Internet, sans serveur, sans compte.
 * Le Wi-Fi doit être *activé*, mais aucun point d'accès n'est rejoint.
 *
 * ── Causes réelles d'échec de la découverte, corrigées ici ──────────────
 *
 *  1. `discoverPeers()` et `discoverServices()` étaient lancés en rafale,
 *     immédiatement après `addServiceRequest()`. Le framework Wi-Fi répond
 *     alors `BUSY` et **annule silencieusement** la découverte de services :
 *     aucun enregistrement DNS-SD n'arrive jamais → « aucun appareil ».
 *     Correction : chaînage strict `addLocalService → addServiceRequest →
 *     discoverPeers → discoverServices`, chaque étape déclenchée dans le
 *     callback de succès de la précédente, avec réessai exponentiel sur BUSY.
 *
 *  2. Android **arrête** la découverte au bout d'environ deux minutes (et
 *     après toute formation/rupture de groupe) sans le signaler. Correction :
 *     ré-armement périodique tant que la recherche est demandée.
 *
 *  3. Sur Android ≤ 12, la découverte P2P ne renvoie *rien* si la
 *     localisation système est désactivée, même avec la permission accordée.
 *     Ce cas n'était pas détecté. Correction : [readiness] expose
 *     `locationEnabled` pour que l'UI propose l'action correspondante.
 *
 *  4. Le Wi-Fi coupé / le P2P indisponible n'étaient pas remontés, et
 *     l'activation du Wi-Fi ne relançait pas la recherche. Correction :
 *     suivi de `WIFI_P2P_STATE_CHANGED` + reprise automatique.
 *
 *  5. Les pairs découverts en DNS-SD disparaissaient dès qu'ils manquaient
 *     une fois de la liste de pairs (les deux flux ne sont pas synchrones) :
 *     la liste clignotait. Correction : expiration par TTL, pas par absence.
 */
class WifiDirectLink(private val ctx: Context, private val events: Events) {

    interface Events {
        fun onPeer(
            id: String,
            name: String,
            deviceId: String,
            code: String?,
            available: Boolean,
        )

        fun onPeerLost(id: String)

        /**
         * state ∈ searching|peer-found|connecting|connected|authenticating|
         * ready|reconnecting|lost|failed|idle|
         * wifi-off|location-off|permission-denied|unsupported
         *
         * `connected` = groupe Wi-Fi Direct formé (lien radio seulement).
         * `ready`     = canal de contrôle ouvert, pair authentifié et
         *               aller-retour vérifié : seul cet état autorise un
         *               transfert côté interface.
         */
        fun onLinkState(
            state: String,
            message: String?,
            isGroupOwner: Boolean?,
            groupOwnerAddress: String?,
            peerName: String?,
            peerDeviceId: String? = null,
        )
    }

    /** Conditions nécessaires, telles que l'UI doit les présenter. */
    data class Readiness(
        val supported: Boolean,
        val permissionGranted: Boolean,
        val wifiEnabled: Boolean,
        val p2pEnabled: Boolean,
        val locationRequired: Boolean,
        val locationEnabled: Boolean,
    ) {
        val ok: Boolean
            get() = supported && permissionGranted && wifiEnabled && p2pEnabled &&
                (!locationRequired || locationEnabled)
    }

    private val manager: WifiP2pManager? =
        ctx.getSystemService(Context.WIFI_P2P_SERVICE) as? WifiP2pManager
    private val wifi: WifiManager? =
        ctx.applicationContext.getSystemService(Context.WIFI_SERVICE) as? WifiManager
    private val locations: LocationManager? =
        ctx.getSystemService(Context.LOCATION_SERVICE) as? LocationManager

    private var channel: WifiP2pManager.Channel? = null
    private var receiver: BroadcastReceiver? = null
    private val main = Handler(Looper.getMainLooper())

    /** Appareils P2P vus par la découverte de pairs (deviceAddress → device). */
    private val devices = ConcurrentHashMap<String, WifiP2pDevice>()

    /** Métadonnées GeniusFiles issues du DNS-SD (deviceAddress → record). */
    private val records = ConcurrentHashMap<String, Map<String, String>>()

    /** Dernière fois qu'un pair a été vu (deviceAddress → uptimeMillis). */
    private val lastSeen = ConcurrentHashMap<String, Long>()

    private var serviceRequest: WifiP2pDnsSdServiceRequest? = null
    private var advertised = false

    /** L'utilisateur veut-il chercher ? Survit à une coupure Wi-Fi. */
    @Volatile
    private var wanted = false

    private var localName = "GeniusFiles"
    private var localDeviceId = ""
    private var localCode: String? = null

    @Volatile
    var p2pEnabled = true
        private set

    @Volatile
    var connected = false
        private set

    /** Une négociation de groupe est en cours (une seule à la fois). */
    @Volatile
    private var connecting = false

    @Volatile
    private var connectStartedAt = 0L


    @Volatile
    var isGroupOwner = false
        private set

    @Volatile
    var groupOwnerAddress: String? = null
        private set

    @Volatile
    private var peerLabel: String? = null

    /** Canal de contrôle réel ; seule preuve valable d'une connexion. */
    private var control: LinkChannel? = null

    @Volatile
    var linkReady = false
        private set

    @Volatile
    var peerDeviceId: String? = null
        private set

    fun isSupported(): Boolean = manager != null

    private val neededPermission: String
        get() =
            if (Build.VERSION.SDK_INT >= 33) Manifest.permission.NEARBY_WIFI_DEVICES
            else Manifest.permission.ACCESS_FINE_LOCATION

    fun hasPermission(): Boolean =
        ctx.checkSelfPermission(neededPermission) == PackageManager.PERMISSION_GRANTED

    private fun locationEnabled(): Boolean = try {
        locations?.isProviderEnabled(LocationManager.GPS_PROVIDER) == true ||
            locations?.isProviderEnabled(LocationManager.NETWORK_PROVIDER) == true
    } catch (_: Exception) {
        false
    }

    fun readiness(): Readiness = Readiness(
        supported = isSupported(),
        permissionGranted = hasPermission(),
        wifiEnabled = wifi?.isWifiEnabled == true,
        p2pEnabled = p2pEnabled,
        // La localisation système n'est indispensable qu'avant Android 13.
        locationRequired = Build.VERSION.SDK_INT < 33,
        locationEnabled = locationEnabled(),
    )

    /* ------------------------------------------------------------------ */
    /* Cycle de vie                                                       */
    /* ------------------------------------------------------------------ */

    private fun ensureChannel(): WifiP2pManager.Channel? {
        val m = manager ?: return null
        if (channel == null) {
            channel = m.initialize(ctx, Looper.getMainLooper()) {
                // Canal perdu (Wi-Fi coupé, framework redémarré) : on le
                // recrée à la prochaine utilisation et on avertit l'UI.
                channel = null
                connected = false
                connecting = false
                groupOwnerAddress = null
                advertised = false
                serviceRequest = null
                closeControlChannel()
                events.onLinkState("lost", "Liaison directe interrompue", null, null, peerLabel, null)
                if (wanted) scheduleRearm(2_000)
            }
        }
        registerReceiver()
        return channel
    }

    private fun registerReceiver() {
        if (receiver != null) return
        val filter = IntentFilter().apply {
            addAction(WifiP2pManager.WIFI_P2P_STATE_CHANGED_ACTION)
            addAction(WifiP2pManager.WIFI_P2P_PEERS_CHANGED_ACTION)
            addAction(WifiP2pManager.WIFI_P2P_CONNECTION_CHANGED_ACTION)
            addAction(WifiP2pManager.WIFI_P2P_THIS_DEVICE_CHANGED_ACTION)
            addAction(WifiManager.WIFI_STATE_CHANGED_ACTION)
        }
        val r = object : BroadcastReceiver() {
            override fun onReceive(c: Context?, intent: Intent?) {
                when (intent?.action) {
                    WifiP2pManager.WIFI_P2P_STATE_CHANGED_ACTION -> {
                        val enabled = intent.getIntExtra(
                            WifiP2pManager.EXTRA_WIFI_STATE,
                            WifiP2pManager.WIFI_P2P_STATE_DISABLED,
                        ) == WifiP2pManager.WIFI_P2P_STATE_ENABLED
                        p2pEnabled = enabled
                        if (!enabled) {
                            connected = false
                            advertised = false
                            serviceRequest = null
                            clearPeers()
                            events.onLinkState(
                                "wifi-off",
                                "Activez le Wi-Fi pour connecter les appareils",
                                null, null, null,
                            )
                        } else if (wanted) {
                            // Reprise automatique : l'utilisateur n'a pas à
                            // quitter puis rouvrir GeniusFiles.
                            scheduleRearm(600)
                        }
                    }
                    WifiManager.WIFI_STATE_CHANGED_ACTION -> {
                        val state = intent.getIntExtra(
                            WifiManager.EXTRA_WIFI_STATE,
                            WifiManager.WIFI_STATE_UNKNOWN,
                        )
                        if (state == WifiManager.WIFI_STATE_ENABLED && wanted) scheduleRearm(1_200)
                    }
                    WifiP2pManager.WIFI_P2P_PEERS_CHANGED_ACTION -> requestPeers()
                    WifiP2pManager.WIFI_P2P_CONNECTION_CHANGED_ACTION -> requestConnectionInfo()
                }
            }
        }
        receiver = r
        if (Build.VERSION.SDK_INT >= 33) {
            ctx.registerReceiver(r, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            @Suppress("UnspecifiedRegisterReceiverFlag")
            ctx.registerReceiver(r, filter)
        }
    }

    fun release() {
        stopNearby()
        closeControlChannel()
        receiver?.let { try { ctx.unregisterReceiver(it) } catch (_: Exception) {} }
        receiver = null
    }

    /* ------------------------------------------------------------------ */
    /* Annonce + découverte                                               */
    /* ------------------------------------------------------------------ */

    /**
     * Publie la présence locale et lance la recherche des appareils
     * GeniusFiles à proximité. Idempotent : un second appel ré-arme
     * simplement la séquence.
     */
    fun startNearby(localName: String, deviceId: String, code: String?) {
        this.localName = localName.ifEmpty { Build.MODEL ?: "GeniusFiles" }
        this.localDeviceId = deviceId
        this.localCode = code
        wanted = true
        val r = readiness()
        if (!r.supported) {
            return events.onLinkState(
                "unsupported", "Cet appareil ne prend pas en charge la liaison directe",
                null, null, null,
            )
        }
        if (!r.permissionGranted) {
            return events.onLinkState(
                "permission-denied", "Autorisation « appareils à proximité » requise",
                null, null, null,
            )
        }
        if (!r.wifiEnabled || !r.p2pEnabled) {
            return events.onLinkState(
                "wifi-off", "Activez le Wi-Fi pour connecter les appareils", null, null, null,
            )
        }
        if (r.locationRequired && !r.locationEnabled) {
            return events.onLinkState(
                "location-off",
                "Activez la localisation : Android l'exige pour détecter les appareils à proximité",
                null, null, null,
            )
        }
        events.onLinkState("searching", null, null, null, null)
        rearm(fromScratch = true)
    }


    /** Coupe découverte et annonce — appelé dès qu'aucun transfert n'est requis. */
    fun stopNearby() {
        wanted = false
        main.removeCallbacks(rearmTask)
        main.removeCallbacks(pruneTask)
        val m = manager ?: return
        val c = channel ?: return
        try {
            m.stopPeerDiscovery(c, null)
            serviceRequest?.let { m.removeServiceRequest(c, it, null) }
            if (advertised) m.clearLocalServices(c, null)
        } catch (_: SecurityException) {
            /* ignore */
        }
        serviceRequest = null
        advertised = false
        clearPeers()
    }

    private fun clearPeers() {
        for (id in records.keys.toList()) events.onPeerLost(id)
        devices.clear()
        records.clear()
        lastSeen.clear()
    }

    private val rearmTask = Runnable { if (wanted) rearm(fromScratch = false) }
    private val pruneTask = Runnable { prune(); schedulePrune() }

    private fun scheduleRearm(delayMs: Long) {
        main.removeCallbacks(rearmTask)
        main.postDelayed(rearmTask, delayMs)
    }

    private fun schedulePrune() {
        main.removeCallbacks(pruneTask)
        main.postDelayed(pruneTask, PRUNE_INTERVAL_MS)
    }

    /**
     * (Re)lance la découverte.
     *
     * Première passe (`fromScratch`) : chaînage strict
     * `addLocalService → addServiceRequest → discoverPeers → discoverServices`,
     * chaque étape déclenchée dans le callback de succès de la précédente
     * (correction du BUSY silencieux).
     *
     * Passes suivantes : l'annonce et la requête de service sont **conservées**
     * — les réenregistrer à chaque cycle remettait le compteur de découverte à
     * zéro et retardait l'apparition des appareils de plusieurs secondes. Seuls
     * `discoverPeers`/`discoverServices` sont relancés, car Android arrête la
     * découverte de lui-même au bout de ~2 minutes.
     */
    private fun rearm(fromScratch: Boolean) {
        if (!wanted || connected || connecting) return
        val m = manager ?: return
        val c = ensureChannel() ?: return
        if (!hasPermission()) return
        if (!fromScratch && advertised && serviceRequest != null) {
            discoverPeers(m, c)
            schedulePrune()
            scheduleRearm(REARM_INTERVAL_MS)
            return
        }
        serviceRequest = null
        advertised = false
        try {
            // Étape 1 — annonce locale (on repart d'une table propre).
            m.clearLocalServices(c, object : WifiP2pManager.ActionListener {
                override fun onSuccess() = addLocalService(m, c)
                override fun onFailure(reason: Int) = addLocalService(m, c)
            })
        } catch (_: SecurityException) {
            events.onLinkState("permission-denied", "Autorisation refusée", null, null, null)
        }
        schedulePrune()
        scheduleRearm(REARM_INTERVAL_MS)
    }


    private fun addLocalService(m: WifiP2pManager, c: WifiP2pManager.Channel) {
        val record = buildMap {
            put("n", localName.take(40))
            put("d", localDeviceId.take(40))
            put("v", GeniusFilesTransferPlugin.PROTO_VERSION.toString())
            localCode?.takeIf { it.isNotEmpty() }?.let { put("c", it) }
        }
        try {
            val info = WifiP2pDnsSdServiceInfo.newInstance(SERVICE_INSTANCE, SERVICE_TYPE, record)
            m.addLocalService(c, info, retrying("addLocalService") {
                advertised = true
                armServiceRequest(m, c)
            })
        } catch (_: SecurityException) {
            events.onLinkState("permission-denied", "Autorisation refusée", null, null, null)
        }
    }

    private fun armServiceRequest(m: WifiP2pManager, c: WifiP2pManager.Channel) {
        // Les écouteurs DNS-SD doivent être posés avant toute découverte.
        try {
            m.setDnsSdResponseListeners(
                c,
                { instanceName, registrationType, device ->
                    if (instanceName.startsWith(SERVICE_INSTANCE) &&
                        registrationType.contains("geniusfiles")
                    ) {
                        devices[device.deviceAddress] = device
                        lastSeen[device.deviceAddress] = android.os.SystemClock.uptimeMillis()
                        publish(device.deviceAddress)
                    }
                },
                { _, txt, device ->
                    records[device.deviceAddress] = txt
                    devices[device.deviceAddress] = device
                    lastSeen[device.deviceAddress] = android.os.SystemClock.uptimeMillis()
                    publish(device.deviceAddress)
                },
            )
            val existing = serviceRequest
            if (existing != null) m.removeServiceRequest(c, existing, null)
            val req = WifiP2pDnsSdServiceRequest.newInstance(SERVICE_INSTANCE, SERVICE_TYPE)
            serviceRequest = req
            m.addServiceRequest(c, req, retrying("addServiceRequest") { discoverPeers(m, c) })
        } catch (_: SecurityException) {
            events.onLinkState("permission-denied", "Autorisation refusée", null, null, null)
        }
    }

    private fun discoverPeers(m: WifiP2pManager, c: WifiP2pManager.Channel) {
        try {
            m.discoverPeers(c, retrying("discoverPeers") { discoverServices(m, c) })
        } catch (_: SecurityException) {
            /* ignore */
        }
    }

    private fun discoverServices(m: WifiP2pManager, c: WifiP2pManager.Channel) {
        try {
            m.discoverServices(c, retrying("discoverServices") { })
        } catch (_: SecurityException) {
            /* ignore */
        }
    }

    /**
     * Écouteur d'action qui réessaie en cas de `BUSY` : le framework Wi-Fi est
     * fréquemment occupé pendant quelques centaines de millisecondes, et un
     * échec non réessayé casse toute la chaîne de découverte.
     */
    private fun retrying(
        tag: String,
        attempt: Int = 0,
        next: () -> Unit,
    ): WifiP2pManager.ActionListener = object : WifiP2pManager.ActionListener {
        override fun onSuccess() = next()
        override fun onFailure(reason: Int) {
            android.util.Log.w("GF_TRANSFER", "p2p $tag failed: ${failureMessage(reason)}")
            if (reason == WifiP2pManager.BUSY && attempt < MAX_RETRY && wanted) {
                val delay = 400L * (attempt + 1)
                main.postDelayed({
                    val m = manager ?: return@postDelayed
                    val c = channel ?: return@postDelayed
                    when (tag) {
                        "addLocalService" -> addLocalService(m, c)
                        "addServiceRequest" -> armServiceRequest(m, c)
                        "discoverPeers" -> discoverPeers(m, c)
                        "discoverServices" -> discoverServices(m, c)
                    }
                }, delay)
            } else if (reason == WifiP2pManager.P2P_UNSUPPORTED) {
                events.onLinkState(
                    "unsupported", "Cet appareil ne prend pas en charge la liaison directe",
                    null, null, null,
                )
            } else {
                // Une étape peut échouer sans être fatale : on continue la
                // chaîne pour ne pas bloquer la découverte.
                next()
            }
        }
    }

    private fun retrying(tag: String, next: () -> Unit) = retrying(tag, 0, next)

    private fun requestPeers() {
        val m = manager ?: return
        val c = channel ?: return
        try {
            m.requestPeers(c) { list ->
                val now = android.os.SystemClock.uptimeMillis()
                for (d in list.deviceList) {
                    devices[d.deviceAddress] = d
                    lastSeen[d.deviceAddress] = now
                    if (records.containsKey(d.deviceAddress)) publish(d.deviceAddress)
                }
            }
        } catch (_: SecurityException) {
            /* ignore */
        }
    }

    /** Expire les pairs par TTL (et non dès une absence ponctuelle). */
    private fun prune() {
        val cutoff = android.os.SystemClock.uptimeMillis() - PEER_TTL_MS
        for ((id, seen) in lastSeen.entries.toList()) {
            if (seen < cutoff) {
                lastSeen.remove(id)
                devices.remove(id)
                if (records.remove(id) != null) events.onPeerLost(id)
            }
        }
    }

    private fun publish(address: String) {
        val device = devices[address] ?: return
        val rec = records[address] ?: return
        // `available` = joignable pour une nouvelle liaison.
        //
        // Correction d'un faux « occupé » : les objets WifiP2pDevice fournis
        // par les callbacks DNS-SD n'ont souvent aucun statut renseigné
        // (UNAVAILABLE par défaut) alors que l'appareil répond parfaitement.
        // Seul le statut CONNECTED, confirmé par la liste de pairs du
        // framework, signifie réellement « déjà engagé dans un groupe ».
        val busy = device.status == WifiP2pDevice.CONNECTED && peerDeviceId != rec["d"]
        events.onPeer(
            id = address,
            name = rec["n"]?.ifEmpty { null } ?: device.deviceName ?: "Appareil",
            deviceId = rec["d"] ?: "",
            code = rec["c"],
            available = !busy,
        )
        // Ne jamais écraser un état de connexion en cours par « appareil
        // détecté » : c'était la cause des changements d'état incessants.
        if (!connected && !connecting && wanted) {
            events.onLinkState("peer-found", null, null, null, rec["n"])
        }
    }


    /* ------------------------------------------------------------------ */
    /* Connexion                                                          */
    /* ------------------------------------------------------------------ */

    /**
     * Forme (ou rejoint) un groupe Wi-Fi Direct avec le pair donné.
     *
     * Une seule négociation peut être active à la fois : un second appel
     * pendant qu'une tentative est en cours est ignoré (c'est ce qui créait
     * plusieurs sessions concurrentes et des états incohérents). La tentative
     * est bornée dans le temps : si le groupe ne se forme pas, on remonte un
     * échec explicite et la découverte reprend.
     */
    fun connect(peerId: String) {
        val m = manager ?: return
        val c = ensureChannel() ?: return
        if (connecting || connected) return
        val device = devices[peerId]
        peerLabel = records[peerId]?.get("n") ?: device?.deviceName
        closeControlChannel()
        connecting = true
        connectStartedAt = android.os.SystemClock.uptimeMillis()
        events.onLinkState("connecting", null, null, null, peerLabel)
        // La découverte est arrêtée pendant la négociation : la garder active
        // fait échouer la formation du groupe sur de nombreux appareils.
        try {
            m.stopPeerDiscovery(c, null)
        } catch (_: SecurityException) {
            /* ignore */
        }
        main.removeCallbacks(rearmTask)
        main.removeCallbacks(connectTimeoutTask)
        main.postDelayed(connectTimeoutTask, CONNECT_TIMEOUT_MS)
        val config = WifiP2pConfig().apply {
            deviceAddress = peerId
            wps.setup = android.net.wifi.WpsInfo.PBC
            // Laisse Android arbitrer le rôle, avec une préférence pour que
            // l'initiateur devienne propriétaire de groupe (il écoutera).
            groupOwnerIntent = 12
        }
        try {
            m.connect(c, config, object : WifiP2pManager.ActionListener {
                override fun onSuccess() { /* l'état réel arrive via le broadcast */ }
                override fun onFailure(reason: Int) = failConnect(failureMessage(reason))
            })
        } catch (_: SecurityException) {
            failConnect("Autorisation « appareils à proximité » refusée")
        }
    }

    private val connectTimeoutTask = Runnable {
        if (connecting && !connected) failConnect("Appareil injoignable — rapprochez les appareils")
    }

    /**
     * Échec **réel** d'une tentative : on ne parle jamais de « connexion
     * interrompue » ni de « reconnexion » ici, puisque aucune connexion n'a
     * existé. La découverte est relancée pour permettre un nouvel essai.
     */
    private fun failConnect(message: String) {
        main.removeCallbacks(connectTimeoutTask)
        connecting = false
        val m = manager
        val c = channel
        if (m != null && c != null) {
            try { m.cancelConnect(c, null) } catch (_: SecurityException) {}
        }
        events.onLinkState("failed", message, null, null, peerLabel, null)
        if (wanted) scheduleRearm(1_200)
    }

    private fun requestConnectionInfo() {
        val m = manager ?: return
        val c = channel ?: return
        m.requestConnectionInfo(c) { info: WifiP2pInfo ->
            if (info.groupFormed) {
                val first = !connected
                connected = true
                connecting = false
                main.removeCallbacks(connectTimeoutTask)
                isGroupOwner = info.isGroupOwner
                groupOwnerAddress = info.groupOwnerAddress?.hostAddress
                if (first) {
                    // Groupe formé : plus besoin de scanner (batterie, CPU).
                    main.removeCallbacks(rearmTask)
                    try {
                        m.stopPeerDiscovery(c, null)
                    } catch (_: SecurityException) {
                        /* ignore */
                    }
                }
                // Le groupe formé n'est qu'un lien radio : on n'annonce pas
                // encore l'appareil comme utilisable.
                events.onLinkState(
                    "connected", null, info.isGroupOwner,
                    groupOwnerAddress, peerLabel, peerDeviceId,
                )
                openControlChannel()
            } else if (connected) {
                connected = false
                groupOwnerAddress = null
                closeControlChannel()
                events.onLinkState("lost", "Connexion interrompue", null, null, peerLabel, null)
                if (wanted) scheduleRearm(1_500)
            } else if (connecting &&
                android.os.SystemClock.uptimeMillis() - connectStartedAt > CONNECT_GRACE_MS
            ) {
                // Le groupe a été refusé / annulé avant d'être formé. La
                // fenêtre de grâce évite de conclure à un échec sur le
                // broadcast émis dès le début de la négociation.
                failConnect("Connexion refusée par l'autre appareil")
            }

        }
    }


    /**
     * Ouvre le canal de contrôle réel. Le propriétaire de groupe écoute,
     * l'autre appareil compose son adresse : la règle est dérivée de l'état
     * système, donc identique et cohérente des deux côtés.
     */
    private fun openControlChannel() {
        if (control != null) return
        val owner = isGroupOwner
        val host = groupOwnerAddress
        if (!owner && host.isNullOrEmpty()) return
        val ch = LinkChannel(
            localName = localName,
            localDeviceId = localDeviceId,
            listen = owner,
            hostAddress = host,
            events = object : LinkChannel.Events {
                override fun onAuthenticating() {
                    linkReady = false
                    events.onLinkState(
                        "authenticating", null, owner, host, peerLabel, peerDeviceId,
                    )
                }

                override fun onReady(peerName: String, peerId: String) {
                    linkReady = true
                    peerLabel = peerName
                    peerDeviceId = peerId
                    events.onLinkState("ready", null, owner, host, peerName, peerId)
                }

                override fun onLost(message: String, retrying: Boolean, everConnected: Boolean) {
                    linkReady = false
                    // « reconnexion »/« interrompue » uniquement si une
                    // connexion réelle a existé ; sinon c'est un échec.
                    val state = when {
                        everConnected && retrying -> "reconnecting"
                        everConnected -> "lost"
                        else -> "failed"
                    }
                    events.onLinkState(state, message, owner, host, peerLabel, peerDeviceId)
                    if (!retrying) {
                        // Abandon définitif : on quitte le groupe pour que la
                        // découverte puisse repartir sur des bases saines
                        // (aucune socket ni session fantôme conservée).
                        connecting = false
                        leaveGroup()
                        if (wanted) scheduleRearm(1_200)
                    }
                }
            },
        )
        control = ch
        ch.start()
    }

    /** Quitte le groupe radio sans changer l'intention de recherche. */
    private fun leaveGroup() {
        val m = manager ?: return
        val c = channel ?: return
        try {
            m.cancelConnect(c, null)
            m.removeGroup(c, null)
        } catch (_: SecurityException) {
            /* ignore */
        }
        closeControlChannel()
        connected = false
        groupOwnerAddress = null
    }

    private fun closeControlChannel() {
        control?.stop()
        control = null
        linkReady = false
        peerDeviceId = null
    }

    /** Quitte le groupe (ou annule une connexion en cours). */
    fun disconnect() {
        val m = manager ?: return
        val c = channel ?: return
        try {
            m.cancelConnect(c, null)
            m.removeGroup(c, null)
        } catch (_: SecurityException) {
            /* ignore */
        }
        main.removeCallbacks(connectTimeoutTask)
        closeControlChannel()
        connected = false
        connecting = false
        groupOwnerAddress = null
        peerLabel = null
        events.onLinkState("idle", null, null, null, null, null)
    }

    private fun failureMessage(reason: Int): String = when (reason) {
        WifiP2pManager.P2P_UNSUPPORTED -> "Cet appareil ne prend pas en charge la liaison directe"
        WifiP2pManager.BUSY -> "Le Wi-Fi est occupé, nouvelle tentative…"
        WifiP2pManager.ERROR -> "Échec de la liaison directe"
        else -> "Liaison directe indisponible"
    }

    companion object {
        /** Instance DNS-SD annoncée dans le canal P2P. */
        const val SERVICE_INSTANCE = "geniusfiles"
        const val SERVICE_TYPE = "_geniusfiles._tcp"

        /** Port TCP fixe écouté par le propriétaire de groupe. */
        const val LINK_PORT = 47771

        /** Android arrête la découverte tout seul : on la relance. */
        private const val REARM_INTERVAL_MS = 12_000L

        /** Fenêtre maximale de formation d'un groupe Wi-Fi Direct. */
        private const val CONNECT_TIMEOUT_MS = 25_000L

        /** Délai avant de considérer un « groupe non formé » comme un refus. */
        private const val CONNECT_GRACE_MS = 6_000L
        private const val PRUNE_INTERVAL_MS = 5_000L
        private const val PEER_TTL_MS = 40_000L
        private const val MAX_RETRY = 4
    }
}
