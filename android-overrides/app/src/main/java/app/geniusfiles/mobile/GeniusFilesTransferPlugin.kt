package app.geniusfiles.mobile

import android.Manifest
import android.content.Context
import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import android.os.Build
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import java.io.BufferedInputStream
import java.io.BufferedOutputStream
import java.io.DataInputStream
import java.io.DataOutputStream
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.IOException
import java.net.InetAddress
import java.net.NetworkInterface
import java.net.ServerSocket
import java.net.Socket
import java.security.MessageDigest
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.LinkedBlockingDeque
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicLong

/**
 * GeniusFilesTransfer — transfert P2P 100 % hors-ligne.
 *
 * Protocole v3 (streaming + duplex pause + reconnexion + retry granulaire).
 *
 * ─────────────  Handshake  ─────────────
 *   HELLO   (rec → send):  <int len><UTF-8 JSON
 *                            {v:3, name, deviceId,
 *                             resume?:{currentFile, fileBytesDone,
 *                                      filesDone, bytesDone}}>
 *   INIT    (send → rec):  <int len><UTF-8 JSON
 *                            {v:3, name, platform, verify,
 *                             expectedFiles, expectedBytes, resumed}>
 *   ACK     (rec → send):  <byte 1|0>  (1 = accepté, 0 = refusé)
 *
 * ─────────────  Envoi (sender → receiver)  ─────────────
 *   tag 0 : END
 *   tag 1 : FILE   <int nameLen><name utf8>
 *                  <long size>
 *                  <long startOffset>          — pour reprise byte-accurate
 *                  <int shaLen><sha utf8>      — SHA du fichier complet
 *                  <raw (size-startOffset) bytes>
 *   tag 2 : MANIFEST_UPDATE  <long addedFiles><long addedBytes>
 *
 * ─────────────  Voie retour (receiver → sender)  ─────────────
 *   lue en continu par un thread dédié côté sender.
 *   byte 1 : FILE_ACK_OK
 *   byte 2 : FILE_ACK_RETRY    (checksum KO → renvoyer le même fichier)
 *   byte 3 : MANIFEST_ACK
 *   byte 4 : CONTROL_PAUSE     (pause demandée par le récepteur)
 *   byte 5 : CONTROL_RESUME
 *
 * ─────────────  Reconnexion  ─────────────
 *   Sur toute IOException non annulée en cours de transfert :
 *     - le sender rouvre un ServerSocket, ré-annonce mDNS et attend
 *       jusqu'à 30 s la reconnexion du même deviceId.
 *     - le receiver retente `connect()` en backoff pendant 30 s puis
 *       renvoie HELLO avec le bloc `resume` (offset dans le fichier en
 *       cours + totaux acquis). Sender repositionne son curseur et
 *       reprend au dernier octet transféré.
 *
 * Évènements JS émis :
 *   peerFound / peerLost, peerReady,
 *   sessionState (handshaking|running|paused|verifying|reconnecting),
 *   sessionProgress, sessionAppended, sessionFileReceived,
 *   sessionDone { verified, filesCount, totalBytes, durationMs },
 *   sessionError { message }
 */
private const val ALIAS_NEARBY_WIFI = "nearbyWifi"
private const val ALIAS_NEARBY_LEGACY = "nearbyLegacy"

@CapacitorPlugin(
    name = "GeniusFilesTransfer",
    permissions = [
        // Android 13+ : autorisation dédiée aux appareils à proximité.
        Permission(alias = ALIAS_NEARBY_WIFI, strings = [Manifest.permission.NEARBY_WIFI_DEVICES]),
        // Android ≤ 12 : la découverte Wi-Fi P2P passe par la localisation fine.
        Permission(alias = ALIAS_NEARBY_LEGACY, strings = [Manifest.permission.ACCESS_FINE_LOCATION]),
    ],
)
class GeniusFilesTransferPlugin : Plugin() {

    /* -------------------------------------------------------- */
    /* Liaison directe Wi-Fi Direct (aucun réseau Wi-Fi commun)  */
    /* -------------------------------------------------------- */

    private var link: WifiDirectLink? = null

    /** Paramètres de la dernière demande d'annonce (rejouée après permission). */
    @Volatile
    private var nearbyArgs: Triple<String, String, String?>? = null

    private val linkEvents = object : WifiDirectLink.Events {
        override fun onPeer(
            id: String,
            name: String,
            deviceId: String,
            code: String?,
            available: Boolean,
        ) {
            notifyListeners("nearbyPeer", JSObject().apply {
                put("id", id); put("name", name); put("deviceId", deviceId)
                put("available", available)
                if (!code.isNullOrEmpty()) put("code", code)
            })
        }

        override fun onPeerLost(id: String) {
            notifyListeners("nearbyPeerLost", JSObject().apply { put("id", id) })
        }

        override fun onLinkState(
            state: String,
            message: String?,
            isGroupOwner: Boolean?,
            groupOwnerAddress: String?,
            peerName: String?,
            peerDeviceId: String?,
        ) {
            notifyListeners("linkState", JSObject().apply {
                put("state", state)
                if (peerDeviceId != null) put("peerDeviceId", peerDeviceId)
                if (message != null) put("message", message)
                if (isGroupOwner != null) put("isGroupOwner", isGroupOwner)
                if (groupOwnerAddress != null) put("groupOwnerAddress", groupOwnerAddress)
                if (peerName != null) put("peerName", peerName)
                put("port", WifiDirectLink.LINK_PORT)
            })
        }
    }

    private fun ensureLink(): WifiDirectLink? {
        val ctx = context ?: return null
        if (link == null) link = WifiDirectLink(ctx, linkEvents)
        return link
    }

    private val nearbyAlias: String
        get() = if (Build.VERSION.SDK_INT >= 33) ALIAS_NEARBY_WIFI else ALIAS_NEARBY_LEGACY

    /**
     * Capacités locales *et* conditions manquantes.
     *
     * L'UI a besoin de distinguer les quatre causes réelles d'échec de la
     * découverte : matériel sans P2P, autorisation refusée, Wi-Fi coupé et
     * localisation système désactivée (obligatoire avant Android 13, sinon la
     * découverte P2P ne renvoie rien du tout).
     */
    @PluginMethod
    fun nearbyStatus(call: PluginCall) {
        val l = ensureLink()
        val r = l?.readiness()
        call.resolve(JSObject().apply {
            put("supported", r?.supported == true)
            put("permissionGranted", r?.permissionGranted == true)
            put("wifiEnabled", r?.wifiEnabled == true)
            put("p2pEnabled", r?.p2pEnabled == true)
            put("locationRequired", r?.locationRequired == true)
            put("locationEnabled", r?.locationEnabled == true)
            put("ready", r?.ok == true)
            put("connected", l?.connected == true)
            // « connecté » ≠ « utilisable » : seul linkReady prouve qu'un
            // canal de communication réel existe entre les deux appareils.
            put("linkReady", l?.linkReady == true)
            l?.peerDeviceId?.let { put("peerDeviceId", it) }
            put("isGroupOwner", l?.isGroupOwner == true)
            l?.groupOwnerAddress?.let { put("groupOwnerAddress", it) }
            put("port", WifiDirectLink.LINK_PORT)
        })
    }

    /** Ouvre les réglages système utiles quand une condition manque. */
    @PluginMethod
    fun openNearbySettings(call: PluginCall) {
        val target = call.getString("target") ?: "wifi"
        val action = when (target) {
            "location" -> android.provider.Settings.ACTION_LOCATION_SOURCE_SETTINGS
            "app" -> android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS
            else -> android.provider.Settings.ACTION_WIFI_SETTINGS
        }
        try {
            val intent = android.content.Intent(action).apply {
                addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
                if (target == "app") data = android.net.Uri.parse("package:${context.packageName}")
            }
            context.startActivity(intent)
            call.resolve(JSObject().apply { put("opened", true) })
        } catch (e: Exception) {
            call.resolve(JSObject().apply {
                put("opened", false); put("message", e.message ?: "")
            })
        }
    }


    /**
     * Annonce l'appareil et lance la recherche des appareils GeniusFiles à
     * proximité. Demande l'autorisation « appareils à proximité » seulement
     * ici, au moment où elle devient réellement nécessaire.
     */
    @PluginMethod
    fun startNearby(call: PluginCall) {
        val l = ensureLink() ?: return call.reject("No context")
        if (!l.isSupported()) {
            call.resolve(JSObject().apply {
                put("started", false); put("reason", "unsupported")
            })
            return
        }
        val name = call.getString("name") ?: (Build.MODEL ?: "GeniusFiles")
        val deviceId = call.getString("deviceId") ?: ""
        val code = call.getString("code")
        nearbyArgs = Triple(name, deviceId, code)
        if (!l.hasPermission()) {
            requestPermissionForAlias(nearbyAlias, call, "nearbyPermissionCallback")
            return
        }
        val r = l.readiness()
        if (!r.wifiEnabled || !r.p2pEnabled) {
            return call.resolve(JSObject().apply {
                put("started", false); put("reason", "wifi-off")
            })
        }
        if (r.locationRequired && !r.locationEnabled) {
            return call.resolve(JSObject().apply {
                put("started", false); put("reason", "location-off")
            })
        }
        l.startNearby(name, deviceId, code)
        call.resolve(JSObject().apply { put("started", true) })
    }


    @PermissionCallback
    private fun nearbyPermissionCallback(call: PluginCall) {
        val l = ensureLink() ?: return call.reject("No context")
        if (!l.hasPermission()) {
            call.resolve(JSObject().apply {
                put("started", false); put("reason", "permission-denied")
            })
            return
        }
        val args = nearbyArgs
        if (args == null) {
            call.resolve(JSObject().apply { put("started", false); put("reason", "cancelled") })
            return
        }
        l.startNearby(args.first, args.second, args.third)
        call.resolve(JSObject().apply { put("started", true) })
    }

    /** Arrête découverte + annonce (batterie). */
    @PluginMethod
    fun stopNearby(call: PluginCall) {
        link?.stopNearby()
        call.resolve()
    }

    /** Forme le groupe Wi-Fi Direct avec le pair détecté. */
    @PluginMethod
    fun connectNearby(call: PluginCall) {
        val peerId = call.getString("peerId") ?: return call.reject("peerId required")
        val l = ensureLink() ?: return call.reject("No context")
        if (!l.hasPermission()) return call.reject("permission-denied")
        l.connect(peerId)
        call.resolve()
    }

    /** Quitte le groupe. */
    @PluginMethod
    fun disconnectNearby(call: PluginCall) {
        link?.disconnect()
        call.resolve()
    }

    private val io = Executors.newCachedThreadPool()
    private val peers = ConcurrentHashMap<String, NsdServiceInfo>()

    private var nsd: NsdManager? = null
    private var discoveryListener: NsdManager.DiscoveryListener? = null
    private var registrationListener: NsdManager.RegistrationListener? = null
    private var registeredServiceName: String? = null

    private val sessions get() = SESSIONS

    override fun load() {
        super.load()
        INSTANCE = this
    }

    override fun handleOnDestroy() {
        try { link?.release() } catch (_: Exception) {}
        link = null
        if (INSTANCE === this) INSTANCE = null
        super.handleOnDestroy()
    }

    /** Une entrée à envoyer : (nom relatif, chemin source, taille). */
    internal data class QueuedFile(val relPath: String, val source: String, val size: Long)

    /** Sentinelles poussées dans la queue pour piloter la boucle d'envoi. */
    internal sealed class SendCommand {
        data class File(val file: QueuedFile, val startOffset: Long = 0L) : SendCommand()
        data class ManifestUpdate(val addedFiles: Long, val addedBytes: Long) : SendCommand()
        object End : SendCommand()
    }

    /** Snapshot du fichier en vol au moment d'une coupure (côté sender). */
    internal data class InFlight(
        val file: QueuedFile,
        @Volatile var sent: Long,
    )

    internal class SessionHandle(
        val id: String,
        val paused: AtomicBoolean = AtomicBoolean(false),
        val cancelled: AtomicBoolean = AtomicBoolean(false),
        @Volatile var socket: Socket? = null,
        @Volatile var server: ServerSocket? = null,
        @Volatile var title: String = "Transfert en cours",
        @Volatile var lastText: String = "Préparation…",
        @Volatile var lastProgress: Int = -1,
        @Volatile var lastNotifAtMs: Long = 0L,
        /** Rôle courant : "sender" | "receiver". */
        @Volatile var role: String = "sender",
        /** Queue de commandes pour la boucle d'envoi (sender uniquement). Deque pour requeue en tête. */
        val queue: LinkedBlockingDeque<SendCommand> = LinkedBlockingDeque(),
        /** Totaux annoncés (croissent en cas d'APPEND). */
        val expectedFiles: AtomicInteger = AtomicInteger(0),
        val expectedBytes: AtomicLong = AtomicLong(0L),
        /** true = verify SHA-256 sur chaque fichier. */
        @Volatile var verify: Boolean = true,
        /** DeviceId du pair (attendu pour la reconnexion). */
        @Volatile var peerDeviceId: String = "",
        /** Fichier en cours d'envoi + octets déjà émis (sender only). */
        @Volatile var inFlight: InFlight? = null,
        /** Signal levé par le reader thread lors d'une coupure. */
        val socketBroken: AtomicBoolean = AtomicBoolean(false),
        /** Sortie du récepteur — sert à propager PAUSE/RESUME au sender. */
        @Volatile var controlOut: DataOutputStream? = null,
    )



    /* -------------------------------------------------------- */
    /* Discovery                                                */
    /* -------------------------------------------------------- */

    @PluginMethod
    fun startDiscovery(call: PluginCall) {
        val ctx = context ?: return call.reject("No context")
        if (nsd == null) nsd = ctx.getSystemService(Context.NSD_SERVICE) as NsdManager
        stopDiscoveryInternal()
        val listener = object : NsdManager.DiscoveryListener {
            override fun onDiscoveryStarted(regType: String) {}
            override fun onStartDiscoveryFailed(t: String, err: Int) {}
            override fun onDiscoveryStopped(t: String) {}
            override fun onStopDiscoveryFailed(t: String, err: Int) {}
            override fun onServiceFound(info: NsdServiceInfo) {
                if (info.serviceName == registeredServiceName) return
                nsd?.resolveService(info, object : NsdManager.ResolveListener {
                    override fun onResolveFailed(si: NsdServiceInfo, err: Int) {}
                    override fun onServiceResolved(si: NsdServiceInfo) {
                        peers[si.serviceName] = si
                        val (code, label) = splitCodeFromName(si.serviceName)
                        val ev = JSObject().apply {
                            put("id", si.serviceName)
                            put("name", label)
                            put("address", si.host?.hostAddress ?: "")
                            put("port", si.port)
                            put("platform", "android")
                            put("transport", "wifi-lan")
                            if (code != null) put("code", code)
                        }
                        notifyListeners("peerFound", ev)
                    }
                })
            }
            override fun onServiceLost(info: NsdServiceInfo) {
                peers.remove(info.serviceName)
                notifyListeners("peerLost", JSObject().apply { put("id", info.serviceName) })
            }
        }
        discoveryListener = listener
        try {
            nsd!!.discoverServices(SERVICE_TYPE, NsdManager.PROTOCOL_DNS_SD, listener)
            call.resolve()
        } catch (e: Exception) {
            call.reject("discover failed: ${e.message}")
        }
    }

    @PluginMethod
    fun stopDiscovery(call: PluginCall) {
        stopDiscoveryInternal(); call.resolve()
    }

    private fun stopDiscoveryInternal() {
        discoveryListener?.let { try { nsd?.stopServiceDiscovery(it) } catch (_: Exception) {} }
        discoveryListener = null
        peers.clear()
    }

    private fun splitCodeFromName(name: String): Pair<String?, String> {
        val m = Regex("^GF_(\\d{4,8})_(.+)$").matchEntire(name) ?: return null to name
        return m.groupValues[1] to m.groupValues[2]
    }

    /* -------------------------------------------------------- */
    /* Sender: host a session                                   */
    /* -------------------------------------------------------- */

    @PluginMethod
    fun hostSession(call: PluginCall) {
        val sessionId = call.getString("sessionId") ?: return call.reject("sessionId required")
        val code = call.getString("code") ?: return call.reject("code required")
        val name = call.getString("name") ?: (Build.MODEL ?: "GeniusFiles")
        val verify = call.getBoolean("verify", true) ?: true
        val filesArr = call.getArray("files") ?: return call.reject("files required")
        /**
         * Liaison directe : quand l'expéditeur est *client* du groupe Wi-Fi
         * Direct, c'est lui qui compose vers le propriétaire de groupe au lieu
         * d'écouter. Le sens des données reste inchangé.
         */
        val dialHost = call.getString("dialHost")
        val dialPort = call.getInt("dialPort") ?: 0
        /** Port d'écoute imposé (propriétaire de groupe Wi-Fi Direct). */
        val fixedPort = call.getInt("fixedPort") ?: 0
        /** Demande une validation explicite du pair avant d'envoyer quoi que ce soit. */
        val requireApproval = call.getBoolean("requireApproval", false) ?: false
        /** Chiffrement applicatif de bout en bout (ECDH + AES-256/CTR). */
        val secure = call.getBoolean("secure", true) ?: true

        val handle = SessionHandle(sessionId).also { sessions[sessionId] = it }
        handle.title = "Envoi vers un appareil"
        handle.role = "sender"
        handle.verify = verify
        pushNotification(handle)

        // Prépare la liste des fichiers initiale et l'empile dans la queue.
        val initial = mutableListOf<QueuedFile>()
        var initialBytes = 0L
        for (i in 0 until filesArr.length()) {
            val o = filesArr.getJSONObject(i)
            val src = o.getString("source")
            val rel = o.optString("relPath", File(src).name)
            val sz = File(src).length()
            initial.add(QueuedFile(rel, src, sz))
            initialBytes += sz
        }
        handle.expectedFiles.set(initial.size)
        handle.expectedBytes.set(initialBytes)
        for (f in initial) handle.queue.offer(SendCommand.File(f))

        try {
            val dialing = !dialHost.isNullOrEmpty() && dialPort > 0
            val firstServer = if (dialing) null else openServerSocket(fixedPort)
            handle.server = firstServer
            val initialPort = firstServer?.localPort ?: dialPort
            val address = if (dialing) dialHost!! else (localIpv4() ?: "")
            if (!dialing) registerService("GF_${code}_${name}", initialPort)
            call.resolve(JSObject().apply {
                put("sessionId", sessionId); put("host", address); put("port", initialPort)
            })

            io.execute {
                emitState(sessionId, "sender", "handshaking", null)
                val startNs = System.nanoTime()
                var bytesDone = 0L
                var filesDone = 0
                var currentServer: ServerSocket? = firstServer
                var attempt = 0
                var completed = false
                var lastError: Exception? = null

                try {
                    outer@ while (!handle.cancelled.get() && !completed) {
                        attempt++

                        val socket: Socket = if (dialing) {
                            if (attempt > 1) emitState(sessionId, "sender", "reconnecting", null)
                            val s = dialWithRetry(
                                dialHost!!, dialPort, handle,
                                if (attempt == 1) 120_000L else RECONNECT_WINDOW_MS,
                            ) ?: throw IOException(if (attempt == 1) "timeout" else "reconnect timeout")
                            s
                        } else {
                            val ss = currentServer ?: run {
                                // Réouverture pour reconnexion : même port si imposé.
                                val ns = openServerSocket(fixedPort)
                                handle.server = ns
                                unregisterService()
                                registerService("GF_${code}_${name}", ns.localPort)
                                emitState(sessionId, "sender", "reconnecting", null)
                                android.util.Log.i("GF_TRANSFER", "waiting reconnect on port=${ns.localPort}")
                                ns
                            }
                            currentServer = ss
                            val acceptTimeout = if (attempt == 1) 120_000 else RECONNECT_WINDOW_MS.toInt()
                            ss.soTimeout = acceptTimeout
                            val accepted: Socket = try { ss.accept() } catch (e: Exception) {
                                if (attempt > 1) throw IOException("reconnect timeout")
                                throw e
                            }
                            try { ss.close() } catch (_: Exception) {}
                            handle.server = null
                            currentServer = null
                            accepted
                        }

                        socket.soTimeout = 0
                        socket.tcpNoDelay = true
                        handle.socket = socket
                        handle.socketBroken.set(false)

                        val rawIn = DataInputStream(BufferedInputStream(socket.getInputStream(), 256 * 1024))
                        val rawOut = DataOutputStream(BufferedOutputStream(socket.getOutputStream(), 256 * 1024))

                        // HELLO
                        val hlen = rawIn.readInt()
                        if (hlen <= 0 || hlen > 64 * 1024) throw IOException("bad hello")
                        val hbuf = ByteArray(hlen).also { rawIn.readFully(it) }
                        val hello = org.json.JSONObject(String(hbuf, Charsets.UTF_8))
                        val peerName = hello.optString("name", "Appareil distant")
                        val peerDeviceId = hello.optString("deviceId", "")
                        val peerSecure = hello.optBoolean("secure", false)
                        val resume = hello.optJSONObject("resume")
                        val isResume = resume != null && attempt > 1

                        if (attempt == 1) {
                            handle.peerDeviceId = peerDeviceId
                            notifyListeners("peerReady", JSObject().apply {
                                put("sessionId", sessionId); put("peerName", peerName)
                                if (peerDeviceId.isNotEmpty()) put("peerDeviceId", peerDeviceId)
                            })
                            if (requireApproval) {
                                notifyListeners("peerRequest", JSObject().apply {
                                    put("sessionId", sessionId); put("peerName", peerName)
                                    if (peerDeviceId.isNotEmpty()) put("peerDeviceId", peerDeviceId)
                                })
                                if (!awaitApproval(sessionId)) {
                                    try { rawOut.writeInt(0); rawOut.flush() } catch (_: Exception) {}
                                    try { socket.close() } catch (_: Exception) {}
                                    throw IOException("refused-locally")
                                }
                            }
                        } else if (peerDeviceId.isNotEmpty() && handle.peerDeviceId.isNotEmpty()
                            && peerDeviceId != handle.peerDeviceId) {
                            try { socket.close() } catch (_: Exception) {}
                            continue@outer // pair inconnu, on ré-attend
                        }

                        // INIT
                        val useSecure = secure && peerSecure
                        val initJson = JSObject().apply {
                            put("v", PROTO_VERSION); put("name", name); put("platform", "android")
                            put("verify", verify)
                            put("expectedFiles", handle.expectedFiles.get())
                            put("expectedBytes", handle.expectedBytes.get())
                            put("resumed", isResume)
                            put("secure", useSecure)
                        }.toString().toByteArray(Charsets.UTF_8)
                        rawOut.writeInt(initJson.size); rawOut.write(initJson); rawOut.flush()
                        val hs = rawIn.readByte(); if (hs.toInt() != 1) throw IOException("declined")

                        // Canal chiffré éphémère (négocié après acceptation).
                        val din: DataInputStream
                        val dout: DataOutputStream
                        if (useSecure) {
                            val streams = SecureChannel.wrap(rawIn, rawOut, initiator = true)
                            din = streams.input; dout = streams.output
                        } else {
                            din = rawIn; dout = rawOut
                        }

                        // Prépare l'état du curseur à partir du HELLO resume, sinon inFlight local.
                        if (isResume) {
                            filesDone = resume!!.optInt("filesDone", filesDone)
                            bytesDone = resume.optLong("bytesDone", bytesDone)
                            val curName = resume.optString("currentFile", "")
                            val curOff = resume.optLong("fileBytesDone", 0L)
                            val inFlight = handle.inFlight
                            if (inFlight != null && inFlight.file.relPath == curName) {
                                inFlight.sent = curOff
                                // On requeue en tête pour envoyer avec le bon offset.
                                handle.queue.offerFirst(SendCommand.File(inFlight.file, curOff))
                            } else if (inFlight != null) {
                                // Pair a moins avancé que nous : on renvoie depuis 0 le fichier en vol.
                                handle.queue.offerFirst(SendCommand.File(inFlight.file, 0L))
                            }
                        }

                        emitState(sessionId, "sender", "running", peerName)


                        // Voie retour : reader thread pour ack + control.
                        val acks: LinkedBlockingQueue<Byte> = LinkedBlockingQueue()
                        val readerAlive = AtomicBoolean(true)
                        val readerThread = Thread {
                            try {
                                while (readerAlive.get()) {
                                    val b = din.readByte()
                                    when (b) {
                                        RSP_CTRL_PAUSE -> {
                                            handle.paused.set(true)
                                            emitState(sessionId, "sender", "paused", null)
                                            android.util.Log.i("GF_TRANSFER", "remote pause")
                                        }
                                        RSP_CTRL_RESUME -> {
                                            handle.paused.set(false)
                                            emitState(sessionId, "sender", "running", null)
                                            android.util.Log.i("GF_TRANSFER", "remote resume")
                                        }
                                        else -> acks.offer(b)
                                    }
                                }
                            } catch (_: Exception) {
                                handle.socketBroken.set(true)
                                acks.offer(0) // débloque le writer
                            }
                        }.apply { setDaemon(true); setName("gf-tx-reader-$sessionId"); start() }

                        try {
                            writerLoop@ while (true) {
                                if (handle.cancelled.get()) {
                                    try { dout.writeByte(TAG_END.toInt()); dout.flush() } catch (_: Exception) {}
                                    throw IOException("cancelled")
                                }
                                if (handle.socketBroken.get()) throw IOException("connection broken")

                                val cmd = handle.queue.poll(500, TimeUnit.MILLISECONDS) ?: continue@writerLoop
                                when (cmd) {
                                    is SendCommand.End -> {
                                        dout.writeByte(TAG_END.toInt()); dout.flush()
                                        completed = true
                                        break@writerLoop
                                    }
                                    is SendCommand.ManifestUpdate -> {
                                        dout.writeByte(TAG_MANIFEST.toInt())
                                        dout.writeLong(cmd.addedFiles)
                                        dout.writeLong(cmd.addedBytes)
                                        dout.flush()
                                        val a = acks.poll(30, TimeUnit.SECONDS)
                                            ?: throw IOException("manifest ack timeout")
                                        if (handle.socketBroken.get()) throw IOException("connection broken")
                                        if (a != RSP_MANIFEST_ACK && a != RSP_ACK_OK)
                                            throw IOException("bad manifest ack")
                                    }
                                    is SendCommand.File -> {
                                        val qf = cmd.file
                                        val srcFile = File(qf.source)
                                        val actualSize = if (srcFile.exists()) srcFile.length() else qf.size
                                        val startOffset = cmd.startOffset.coerceIn(0L, actualSize)
                                        val inFlight = InFlight(qf, startOffset).also { handle.inFlight = it }

                                        dout.writeByte(TAG_FILE.toInt())
                                        val nameBytes = qf.relPath.toByteArray(Charsets.UTF_8)
                                        dout.writeInt(nameBytes.size); dout.write(nameBytes)
                                        dout.writeLong(actualSize)
                                        dout.writeLong(startOffset)
                                        if (verify) {
                                            val sha = sha256File(qf.source).toByteArray(Charsets.UTF_8)
                                            dout.writeInt(sha.size); dout.write(sha)
                                        } else {
                                            dout.writeInt(0)
                                        }

                                        FileInputStream(qf.source).use { fis ->
                                            if (startOffset > 0) {
                                                var toSkip = startOffset
                                                while (toSkip > 0) {
                                                    val skipped = fis.skip(toSkip)
                                                    if (skipped <= 0) break
                                                    toSkip -= skipped
                                                }
                                            }
                                            val buf = ByteArray(256 * 1024)
                                            var sent = startOffset
                                            // On compte les octets déjà comptabilisés pour ce fichier
                                            // afin de ne pas les recompter dans bytesDone.
                                            var newBytesForThisFile = 0L
                                            while (sent < actualSize) {
                                                while (handle.paused.get() && !handle.cancelled.get() && !handle.socketBroken.get())
                                                    Thread.sleep(120)
                                                if (handle.cancelled.get()) throw IOException("cancelled")
                                                if (handle.socketBroken.get()) throw IOException("connection broken")
                                                val n = fis.read(buf)
                                                if (n <= 0) break
                                                dout.write(buf, 0, n)
                                                sent += n
                                                inFlight.sent = sent
                                                newBytesForThisFile += n
                                                emitProgress(
                                                    sessionId, bytesDone + newBytesForThisFile,
                                                    handle.expectedBytes.get(),
                                                    filesDone, handle.expectedFiles.get(),
                                                    qf.relPath, sent, actualSize, startNs,
                                                )
                                            }
                                            dout.flush()
                                            bytesDone += newBytesForThisFile
                                        }

                                        // Attente d'ack sans bloquer la pause : timeout court + relance.
                                        val a = pollAckPatient(acks, handle)
                                        if (handle.socketBroken.get()) throw IOException("connection broken")
                                        when (a) {
                                            RSP_ACK_OK -> {
                                                filesDone++
                                                handle.inFlight = null
                                                emitProgress(
                                                    sessionId, bytesDone, handle.expectedBytes.get(),
                                                    filesDone, handle.expectedFiles.get(),
                                                    qf.relPath, actualSize, actualSize, startNs,
                                                )
                                                if (filesDone >= handle.expectedFiles.get() && handle.queue.isEmpty()) {
                                                    io.execute {
                                                        Thread.sleep(1200)
                                                        if (filesDone >= handle.expectedFiles.get() && handle.queue.isEmpty()) {
                                                            handle.queue.offer(SendCommand.End)
                                                        }
                                                    }
                                                }
                                            }
                                            RSP_ACK_RETRY -> {
                                                android.util.Log.w("GF_TRANSFER", "checksum retry for ${qf.relPath}")
                                                // Rollback des octets comptés pour ce fichier et re-enqueue depuis 0.
                                                bytesDone -= (actualSize - startOffset)
                                                if (bytesDone < 0) bytesDone = 0
                                                handle.inFlight = null
                                                handle.queue.offerFirst(SendCommand.File(qf, 0L))
                                            }
                                            else -> throw IOException("bad file ack: $a")
                                        }
                                    }
                                }
                            }
                        } catch (e: IOException) {
                            lastError = e
                            readerAlive.set(false)
                            try { socket.close() } catch (_: Exception) {}
                            if (handle.cancelled.get()) throw e
                            if (completed) { /* fin normale */ }
                            else {
                                // On tente une reconnexion.
                                android.util.Log.w("GF_TRANSFER", "socket lost, will wait for reconnect: ${e.message}")
                                continue@outer
                            }
                        } finally {
                            readerAlive.set(false)
                            try { readerThread.interrupt() } catch (_: Exception) {}
                        }

                        break@outer // completed=true
                    }

                    if (completed) {
                        val durationMs = (System.nanoTime() - startNs) / 1_000_000L
                        emitDone(sessionId, verify, filesDone, bytesDone, durationMs)
                    } else if (handle.cancelled.get()) {
                        emitError(sessionId, "cancelled")
                    } else {
                        emitError(sessionId, friendlyErrorMessage(lastError ?: IOException("aborted")))
                    }
                } catch (e: Exception) {
                    emitError(sessionId, friendlyErrorMessage(e))
                } finally {
                    unregisterService()
                    try { handle.server?.close() } catch (_: Exception) {}
                    try { currentServer?.close() } catch (_: Exception) {}
                    sessions.remove(sessionId)
                    stopNotificationIfIdle()
                }
            }
        } catch (e: Exception) {
            sessions.remove(sessionId)
            call.reject("host failed: ${e.message}")
        }
    }


    /* -------------------------------------------------------- */
    /* Receiver: join a session                                 */
    /* -------------------------------------------------------- */

    @PluginMethod
    fun joinSession(call: PluginCall) {
        val sessionId = call.getString("sessionId") ?: return call.reject("sessionId required")
        val host = call.getString("host") ?: return call.reject("host required")
        val port = call.getInt("port") ?: return call.reject("port required")
        val name = call.getString("name") ?: (Build.MODEL ?: "GeniusFiles")
        val deviceId = call.getString("deviceId") ?: ""
        val inbox = call.getString("inbox") ?: return call.reject("inbox required")
        File(inbox).apply { if (!exists()) mkdirs() }
        /**
         * Liaison directe : quand le récepteur est *propriétaire de groupe*
         * Wi-Fi Direct, c'est lui qui écoute (l'expéditeur compose). Le sens
         * des données reste inchangé — seul le rôle réseau s'inverse.
         */
        val listen = call.getBoolean("listen", false) ?: false
        val fixedPort = call.getInt("fixedPort") ?: 0
        /** Chiffrement applicatif de bout en bout (ECDH + AES-256/CTR). */
        val secure = call.getBoolean("secure", true) ?: true

        val handle = SessionHandle(sessionId).also { sessions[sessionId] = it }
        handle.title = "Réception depuis un appareil"
        handle.role = "receiver"
        handle.peerDeviceId = deviceId
        pushNotification(handle)
        call.resolve(JSObject().apply { put("sessionId", sessionId) })

        io.execute {
            emitState(sessionId, "receiver", "handshaking", null)
            val startNs = System.nanoTime()
            var bytesDone = 0L
            var filesDone = 0
            var verifiedAll = true
            var completed = false
            var lastError: Exception? = null

            // État inter-connexion : fichier en cours (peut survivre à une reconnexion).
            var curRel: String? = null
            var curTarget: File? = null
            var curSize = 0L
            var curWritten = 0L
            var curSha: String = ""
            var curDigest: MessageDigest? = null
            var curFos: FileOutputStream? = null

            // Cible/port courants (peuvent changer si le sender rouvre sur un nouveau port).
            var curHost = host
            var curPort = port
            var attempt = 0

            try {
                outer@ while (!handle.cancelled.get() && !completed) {
                    attempt++
                    if (attempt > 1) {
                        emitState(sessionId, "receiver", "reconnecting", null)
                        // Tentative de résolution mDNS pour retrouver un port éventuellement changé.
                        val fresh = resolvePeerViaMdns(handle.peerDeviceId)
                        if (fresh != null) { curHost = fresh.first; curPort = fresh.second }
                    }

                    val socket: Socket = if (listen) {
                        // Récepteur propriétaire de groupe : on attend l'expéditeur.
                        val ss = handle.server ?: openServerSocket(fixedPort).also { handle.server = it }
                        ss.soTimeout = if (attempt == 1) 120_000 else RECONNECT_WINDOW_MS.toInt()
                        val accepted = try {
                            ss.accept()
                        } catch (e: Exception) {
                            if (attempt == 1) throw e
                            if ((System.nanoTime() - startNs) / 1_000_000L > RECONNECT_WINDOW_MS + 30_000) {
                                throw IOException("reconnect timeout")
                            }
                            continue@outer
                        }
                        accepted
                    } else {
                        val s = Socket()
                        try {
                            s.connect(
                                java.net.InetSocketAddress(InetAddress.getByName(curHost), curPort),
                                if (attempt == 1) 15_000 else 30_000,
                            )
                        } catch (e: Exception) {
                            try { s.close() } catch (_: Exception) {}
                            if (attempt == 1) throw e
                            // Backoff court avant nouvelle tentative
                            Thread.sleep(1200)
                            if ((System.nanoTime() - startNs) / 1_000_000L > RECONNECT_WINDOW_MS + 30_000) {
                                throw IOException("reconnect timeout")
                            }
                            continue@outer
                        }
                        s
                    }
                    socket.soTimeout = 0
                    socket.tcpNoDelay = true
                    handle.socket = socket

                    val rawIn = DataInputStream(BufferedInputStream(socket.getInputStream(), 256 * 1024))
                    val rawOut = DataOutputStream(BufferedOutputStream(socket.getOutputStream(), 256 * 1024))

                    // HELLO (avec bloc resume si applicable)
                    val hello = JSObject().apply {
                        put("v", PROTO_VERSION); put("name", name)
                        put("secure", secure)
                        if (deviceId.isNotEmpty()) put("deviceId", deviceId)
                        if (attempt > 1 && curRel != null) {
                            put("resume", JSObject().apply {
                                put("currentFile", curRel)
                                put("fileBytesDone", curWritten)
                                put("filesDone", filesDone)
                                put("bytesDone", bytesDone)
                            })
                        }
                    }.toString().toByteArray(Charsets.UTF_8)
                    rawOut.writeInt(hello.size); rawOut.write(hello); rawOut.flush()

                    // INIT
                    val hlen = rawIn.readInt()
                    if (hlen <= 0 || hlen > 1 * 1024 * 1024) throw IOException("bad init")
                    val hbuf = ByteArray(hlen).also { rawIn.readFully(it) }
                    val init = org.json.JSONObject(String(hbuf, Charsets.UTF_8))
                    val expectedFiles0 = init.optInt("expectedFiles", 0)
                    val expectedBytes0 = init.optLong("expectedBytes", 0L)
                    handle.expectedFiles.set(expectedFiles0)
                    handle.expectedBytes.set(expectedBytes0)
                    handle.verify = init.optBoolean("verify", true)
                    rawOut.writeByte(1); rawOut.flush()

                    // Canal chiffré éphémère — activé uniquement si l'expéditeur
                    // l'a confirmé dans INIT (rétrocompatible avec un pair v3).
                    val din: DataInputStream
                    val dout: DataOutputStream
                    if (secure && init.optBoolean("secure", false)) {
                        val streams = SecureChannel.wrap(rawIn, rawOut, initiator = false)
                        din = streams.input; dout = streams.output
                    } else {
                        din = rawIn; dout = rawOut
                    }
                    handle.controlOut = dout
                    emitState(sessionId, "receiver", "running", init.optString("name", null))

                    try {
                        loop@ while (true) {
                            if (handle.cancelled.get()) throw IOException("cancelled")
                            val tag = try {
                                din.readByte()
                            } catch (_: java.io.EOFException) { TAG_END }
                            when (tag) {
                                TAG_END -> { completed = true; break@loop }
                                TAG_MANIFEST -> {
                                    val addedFiles = din.readLong()
                                    val addedBytes = din.readLong()
                                    val ef = handle.expectedFiles.addAndGet(addedFiles.toInt())
                                    val eb = handle.expectedBytes.addAndGet(addedBytes)
                                    dout.writeByte(RSP_MANIFEST_ACK.toInt()); dout.flush()
                                    notifyListeners("sessionAppended", JSObject().apply {
                                        put("sessionId", sessionId)
                                        put("filesAdded", addedFiles)
                                        put("bytesAdded", addedBytes)
                                        put("expectedFiles", ef)
                                        put("expectedBytes", eb)
                                    })
                                }
                                TAG_FILE -> {
                                    val nameLen = din.readInt()
                                    if (nameLen <= 0 || nameLen > 8 * 1024) throw IOException("bad name")
                                    val nameBuf = ByteArray(nameLen).also { din.readFully(it) }
                                    val rel = String(nameBuf, Charsets.UTF_8)
                                    val size = din.readLong()
                                    val startOffset = din.readLong()
                                    val shaLen = din.readInt()
                                    val expectedSha = if (shaLen > 0) {
                                        val buf = ByteArray(shaLen); din.readFully(buf); String(buf, Charsets.UTF_8)
                                    } else ""

                                    val resumingSame = curRel == rel && startOffset > 0
                                    val target: File
                                    val md: MessageDigest
                                    val fos: FileOutputStream

                                    if (resumingSame && curTarget != null && curDigest != null) {
                                        target = curTarget!!
                                        md = curDigest!!
                                        // Rouvre en append (le fos précédent a été fermé lors de la coupure).
                                        fos = FileOutputStream(target, true)
                                        // Sécurité : tronque si sender a fourni un offset < notre write pointer
                                        if (target.length() > startOffset) {
                                            fos.close()
                                            val raf = java.io.RandomAccessFile(target, "rw")
                                            raf.setLength(startOffset); raf.close()
                                            curWritten = startOffset
                                        }
                                    } else {
                                        // Nouveau fichier (ou retry from 0)
                                        target = uniquePath(File(inbox), rel)
                                        target.parentFile?.mkdirs()
                                        md = MessageDigest.getInstance("SHA-256")
                                        fos = FileOutputStream(target, false)
                                        curRel = rel
                                        curTarget = target
                                        curSize = size
                                        curWritten = 0L
                                        curSha = expectedSha
                                    }
                                    curFos = fos

                                    try {
                                        val buf = ByteArray(256 * 1024)
                                        var remaining = size - curWritten
                                        while (remaining > 0) {
                                            while (handle.paused.get() && !handle.cancelled.get())
                                                Thread.sleep(120)
                                            if (handle.cancelled.get()) throw IOException("cancelled")
                                            val toRead = minOf(buf.size.toLong(), remaining).toInt()
                                            val n = din.read(buf, 0, toRead)
                                            if (n < 0) throw IOException("stream closed at $rel")
                                            fos.write(buf, 0, n); md.update(buf, 0, n)
                                            remaining -= n
                                            curWritten += n
                                            bytesDone += n
                                            emitProgress(
                                                sessionId, bytesDone, maxOf(handle.expectedBytes.get(), bytesDone),
                                                filesDone, maxOf(handle.expectedFiles.get(), filesDone + 1),
                                                rel, curWritten, size, startNs,
                                            )
                                        }
                                        fos.flush(); fos.fd.sync()
                                    } finally {
                                        try { fos.close() } catch (_: Exception) {}
                                        curFos = null
                                    }

                                    val actual = md.digest().joinToString("") { "%02x".format(it) }
                                    if (expectedSha.isNotEmpty() && expectedSha != actual) {
                                        android.util.Log.w("GF_TRANSFER", "checksum mismatch on $rel — asking retry")
                                        // Retry granulaire : supprime le fichier, rollback compteurs, demande RETRY.
                                        try { target.delete() } catch (_: Exception) {}
                                        bytesDone -= curWritten
                                        if (bytesDone < 0) bytesDone = 0
                                        curWritten = 0L
                                        curRel = null; curTarget = null; curDigest = null
                                        dout.writeByte(RSP_ACK_RETRY.toInt()); dout.flush()
                                        continue@loop
                                    }
                                    dout.writeByte(RSP_ACK_OK.toInt()); dout.flush()
                                    filesDone++
                                    // Fichier validé : on peut oublier l'état de reprise.
                                    curRel = null; curTarget = null; curDigest = null
                                    curWritten = 0L
                                    emitProgress(
                                        sessionId, bytesDone, maxOf(handle.expectedBytes.get(), bytesDone),
                                        filesDone, maxOf(handle.expectedFiles.get(), filesDone),
                                        rel, size, size, startNs,
                                    )
                                    notifyListeners("sessionFileReceived", JSObject().apply {
                                        put("sessionId", sessionId)
                                        put("name", rel)
                                        put("size", size)
                                        put("path", target.absolutePath)
                                    })
                                }
                                else -> throw IOException("unknown tag $tag")
                            }
                        }
                    } catch (e: IOException) {
                        lastError = e
                        handle.controlOut = null
                        try { curFos?.close() } catch (_: Exception) {}
                        curFos = null
                        try { socket.close() } catch (_: Exception) {}
                        if (handle.cancelled.get()) throw e
                        if (!completed) {
                            android.util.Log.w("GF_TRANSFER", "receiver socket lost, reconnecting: ${e.message}")
                            // Petit délai pour laisser le sender rouvrir son ServerSocket.
                            Thread.sleep(800)
                            continue@outer
                        }
                    } finally {
                        handle.controlOut = null
                        try { socket.close() } catch (_: Exception) {}
                    }


                    if (completed) break@outer
                }

                if (completed) {
                    val durationMs = (System.nanoTime() - startNs) / 1_000_000L
                    emitDone(sessionId, verifiedAll, filesDone, bytesDone, durationMs)
                } else if (handle.cancelled.get()) {
                    emitError(sessionId, "cancelled")
                } else {
                    emitError(sessionId, friendlyErrorMessage(lastError ?: IOException("aborted")))
                }
            } catch (e: Exception) {
                emitError(sessionId, friendlyErrorMessage(e))
            } finally {
                try { handle.server?.close() } catch (_: Exception) {}
                handle.server = null
                try { curFos?.close() } catch (_: Exception) {}
                // Nettoyage d'un partiel non validé (si annulé ou échec définitif)
                if (!completed && curTarget != null) {
                    try { curTarget!!.delete() } catch (_: Exception) {}
                }
                sessions.remove(sessionId)
                stopNotificationIfIdle()
            }
        }
    }

    /* -------------------------------------------------------- */
    /* Helpers de session — factorisation                       */
    /* -------------------------------------------------------- */

    private fun openServerSocket(fixedPort: Int = 0): ServerSocket {
        val ss = ServerSocket()
        ss.reuseAddress = true
        ss.bind(java.net.InetSocketAddress(if (fixedPort > 0) fixedPort else 0))
        return ss
    }

    /**
     * Compose vers un pair en réessayant jusqu'à `windowMs` : sur liaison
     * directe, le serveur du pair peut apparaître quelques secondes après la
     * formation du groupe Wi-Fi Direct.
     */
    private fun dialWithRetry(
        host: String,
        port: Int,
        handle: SessionHandle,
        windowMs: Long,
    ): Socket? {
        val deadline = System.currentTimeMillis() + windowMs
        while (!handle.cancelled.get() && System.currentTimeMillis() < deadline) {
            val s = Socket()
            try {
                s.connect(java.net.InetSocketAddress(InetAddress.getByName(host), port), 6_000)
                return s
            } catch (_: Exception) {
                try { s.close() } catch (_: Exception) {}
                Thread.sleep(900)
            }
        }
        return null
    }

    /**
     * Attend la décision locale de l'utilisateur (« Galaxy de David souhaite
     * se connecter »). Refus par défaut au bout de 60 s.
     */
    private fun awaitApproval(sessionId: String): Boolean {
        APPROVALS.remove(sessionId)
        val deadline = System.currentTimeMillis() + 60_000
        while (System.currentTimeMillis() < deadline) {
            APPROVALS[sessionId]?.let { return it }
            Thread.sleep(150)
        }
        return false
    }

    /** Réponse de l'UI à `peerRequest`. */
    @PluginMethod
    fun approvePeer(call: PluginCall) {
        val id = call.getString("sessionId") ?: return call.reject("sessionId required")
        APPROVALS[id] = call.getBoolean("accept", false) ?: false
        call.resolve()
    }


    /**
     * Attend un ack en tolérant les longues pauses : si la pause est active,
     * on continue à attendre sans considérer un timeout d'inactivité comme
     * une erreur. Sinon, timeout de 45 s = probable perte de connexion.
     */
    private fun pollAckPatient(
        acks: LinkedBlockingQueue<Byte>,
        handle: SessionHandle,
    ): Byte {
        while (true) {
            if (handle.cancelled.get()) throw IOException("cancelled")
            if (handle.socketBroken.get()) throw IOException("connection broken")
            val a = acks.poll(1, TimeUnit.SECONDS) ?: continue
            return a
        }
    }

    /**
     * Résolution mDNS ad-hoc pour retrouver la nouvelle adresse d'un
     * expéditeur après reconnexion (utile si le sender a rouvert sur un
     * nouveau port). Retourne (host, port) ou null.
     */
    private fun resolvePeerViaMdns(peerDeviceId: String): Pair<String, Int>? {
        // Utilise la table de peers déjà découverts si elle est active.
        for (info in peers.values) {
            val host = info.host?.hostAddress ?: continue
            if (info.port > 0) return host to info.port
        }
        return null
    }



    /* -------------------------------------------------------- */
    /* Control                                                  */
    /* -------------------------------------------------------- */

    @PluginMethod
    fun pauseSession(call: PluginCall) {
        val id = call.getString("sessionId") ?: return call.reject("sessionId required")
        sessions[id]?.let {
            it.paused.set(true)
            // Propagation duplex : le récepteur informe le sender via la voie retour.
            val out = it.controlOut
            if (out != null) {
                try { synchronized(out) { out.writeByte(RSP_CTRL_PAUSE.toInt()); out.flush() } } catch (_: Exception) {}
            }
            pushNotification(it)
            android.util.Log.i("GF_TRANSFER", "pause $id (role=${it.role})")
            emitState(id, it.role, "paused", null)
        }
        call.resolve()
    }

    @PluginMethod
    fun resumeSession(call: PluginCall) {
        val id = call.getString("sessionId") ?: return call.reject("sessionId required")
        sessions[id]?.let {
            it.paused.set(false)
            val out = it.controlOut
            if (out != null) {
                try { synchronized(out) { out.writeByte(RSP_CTRL_RESUME.toInt()); out.flush() } } catch (_: Exception) {}
            }
            pushNotification(it)
            android.util.Log.i("GF_TRANSFER", "resume $id (role=${it.role})")
            emitState(id, it.role, "running", null)
        }
        call.resolve()
    }

    @PluginMethod
    fun cancelSession(call: PluginCall) {
        val id = call.getString("sessionId") ?: return call.reject("sessionId required")
        val h = sessions[id]
        h?.cancelled?.set(true)
        try { h?.socket?.close() } catch (_: Exception) {}
        try { h?.server?.close() } catch (_: Exception) {}
        android.util.Log.i("GF_TRANSFER", "cancel $id")
        call.resolve()
    }


    /**
     * Ajoute des fichiers à une session déjà ouverte. Sans effet si la
     * session n'existe pas ou est terminée.
     */
    @PluginMethod
    fun appendSession(call: PluginCall) {
        val id = call.getString("sessionId") ?: return call.reject("sessionId required")
        val filesArr = call.getArray("files") ?: return call.reject("files required")
        val h = sessions[id] ?: return call.reject("NOT_FOUND", "session not active")
        val added = mutableListOf<QueuedFile>()
        var addedBytes = 0L
        for (i in 0 until filesArr.length()) {
            val o = filesArr.getJSONObject(i)
            val src = o.getString("source")
            val rel = o.optString("relPath", File(src).name)
            val f = File(src); if (!f.exists() || f.isDirectory) continue
            val sz = f.length()
            added.add(QueuedFile(rel, src, sz))
            addedBytes += sz
        }
        if (added.isEmpty()) return call.reject("BAD_ARGS", "no valid files")
        h.expectedFiles.addAndGet(added.size)
        h.expectedBytes.addAndGet(addedBytes)
        // Annonce le nouveau volume au récepteur, puis pousse les fichiers.
        h.queue.offer(SendCommand.ManifestUpdate(added.size.toLong(), addedBytes))
        for (qf in added) h.queue.offer(SendCommand.File(qf))
        pushNotification(h)
        call.resolve(JSObject().apply {
            put("added", added.size)
            put("addedBytes", addedBytes)
            put("expectedFiles", h.expectedFiles.get())
            put("expectedBytes", h.expectedBytes.get())
        })
    }

    /** Ferme proprement la session côté expéditeur (envoie END au pair). */
    @PluginMethod
    fun endSession(call: PluginCall) {
        val id = call.getString("sessionId") ?: return call.reject("sessionId required")
        sessions[id]?.queue?.offer(SendCommand.End)
        call.resolve()
    }


    @PluginMethod
    fun localAddress(call: PluginCall) {
        call.resolve(JSObject().apply { put("address", localIpv4() ?: "") })
    }

    /* -------------------------------------------------------- */
    /* Advertise (mDNS)                                         */
    /* -------------------------------------------------------- */

    private fun registerService(fullServiceName: String, port: Int) {
        val ctx = context ?: return
        if (nsd == null) nsd = ctx.getSystemService(Context.NSD_SERVICE) as NsdManager
        val info = NsdServiceInfo().apply {
            serviceName = fullServiceName
            serviceType = SERVICE_TYPE
            this.port = port
        }
        val listener = object : NsdManager.RegistrationListener {
            override fun onRegistrationFailed(si: NsdServiceInfo, err: Int) {}
            override fun onUnregistrationFailed(si: NsdServiceInfo, err: Int) {}
            override fun onServiceRegistered(si: NsdServiceInfo) { registeredServiceName = si.serviceName }
            override fun onServiceUnregistered(si: NsdServiceInfo) {}
        }
        registrationListener = listener
        try { nsd!!.registerService(info, NsdManager.PROTOCOL_DNS_SD, listener) } catch (_: Exception) {}
    }

    private fun unregisterService() {
        registrationListener?.let { try { nsd?.unregisterService(it) } catch (_: Exception) {} }
        registrationListener = null
        registeredServiceName = null
    }

    /* -------------------------------------------------------- */
    /* Helpers                                                  */
    /* -------------------------------------------------------- */

    private fun friendlyErrorMessage(e: Exception): String {
        val m = e.message ?: return "Erreur de transfert"
        return when {
            m.contains("cancel", ignoreCase = true) -> "cancelled"
            m.contains("timeout", ignoreCase = true) -> "Le pair n'a pas répondu à temps."
            m.contains("checksum", ignoreCase = true) -> "Vérification d'intégrité échouée."
            m.contains("refused", ignoreCase = true) -> "Connexion refusée."
            m.contains("declined", ignoreCase = true) -> "Le destinataire a refusé l'envoi."
            else -> m
        }
    }

    private fun emitState(id: String, role: String, state: String, peer: String?) {
        val ev = JSObject().apply {
            put("sessionId", id); put("role", role); put("state", state)
            if (peer != null) put("peer", peer)
        }
        notifyListeners("sessionState", ev)
        val h = sessions[id] ?: return
        h.lastText = when (state) {
            "handshaking" -> "Connexion en cours…"
            "running" -> if (peer != null) "Transfert avec $peer" else "Transfert en cours"
            "paused" -> "Transfert en pause"
            "verifying" -> "Vérification…"
            else -> h.lastText
        }
        pushNotification(h)
    }

    private fun emitProgress(
        id: String, bytesDone: Long, bytesTotal: Long,
        fileIdx: Int, fileCount: Int, currentName: String,
        currentDone: Long, currentTotal: Long, startNs: Long,
    ) {
        val elapsedSec = maxOf(0.001, (System.nanoTime() - startNs) / 1_000_000_000.0)
        val bps = (bytesDone / elapsedSec).toLong()
        val remaining = maxOf(0L, bytesTotal - bytesDone)
        val eta = if (bps > 0) remaining / bps else 0L
        val ev = JSObject().apply {
            put("sessionId", id); put("bytesDone", bytesDone); put("bytesTotal", bytesTotal)
            put("filesDone", fileIdx); put("filesTotal", fileCount)
            put("currentFile", currentName)
            put("currentFileBytesDone", currentDone); put("currentFileBytesTotal", currentTotal)
            put("bytesPerSecond", bps); put("etaSeconds", eta)
        }
        notifyListeners("sessionProgress", ev)

        val h = sessions[id] ?: return
        val pct = if (bytesTotal > 0) ((bytesDone * 100L) / bytesTotal).toInt().coerceIn(0, 100) else -1
        h.lastProgress = pct
        h.lastText = "${fileIdx + 1}/$fileCount · $currentName"
        val now = System.currentTimeMillis()
        if (now - h.lastNotifAtMs >= 800L || pct == 100) {
            h.lastNotifAtMs = now
            pushNotification(h)
        }
    }

    private fun emitDone(id: String, verified: Boolean, filesCount: Int, totalBytes: Long, durationMs: Long) {
        notifyListeners("sessionDone", JSObject().apply {
            put("sessionId", id); put("verified", verified)
            put("filesCount", filesCount); put("totalBytes", totalBytes)
            put("durationMs", durationMs)
        })
    }

    private fun emitError(id: String, message: String) {
        notifyListeners("sessionError", JSObject().apply {
            put("sessionId", id); put("message", message)
        })
    }

    /* -------------------------------------------------------- */
    /* Foreground notification bridge                           */
    /* -------------------------------------------------------- */

    private fun pushNotification(handle: SessionHandle) {
        val ctx = context ?: return
        TransferForegroundService.update(
            ctx,
            sessionId = handle.id,
            title = handle.title,
            text = if (handle.paused.get()) "En pause · ${handle.lastText}" else handle.lastText,
            progress = handle.lastProgress,
            paused = handle.paused.get(),
        )
    }

    private fun stopNotificationIfIdle() {
        if (sessions.isEmpty()) {
            val ctx = context ?: return
            TransferForegroundService.stop(ctx)
        }
    }

    private fun sha256File(path: String): String {
        val md = MessageDigest.getInstance("SHA-256")
        FileInputStream(path).use { fis ->
            val buf = ByteArray(64 * 1024)
            while (true) { val n = fis.read(buf); if (n <= 0) break; md.update(buf, 0, n) }
        }
        return md.digest().joinToString("") { "%02x".format(it) }
    }

    private fun uniquePath(dir: File, name: String): File {
        var f = File(dir, name); if (!f.exists()) return f
        val dot = name.lastIndexOf('.')
        val base = if (dot > 0) name.substring(0, dot) else name
        val ext = if (dot > 0) name.substring(dot) else ""
        var i = 2
        while (true) {
            f = File(dir, "$base ($i)$ext"); if (!f.exists()) return f; i++
        }
    }

    private fun localIpv4(): String? {
        try {
            val ifaces = NetworkInterface.getNetworkInterfaces() ?: return null
            for (iface in ifaces) {
                if (iface.isLoopback || !iface.isUp) continue
                for (addr in iface.inetAddresses) {
                    if (!addr.isLoopbackAddress && addr.hostAddress?.contains(":") == false) {
                        return addr.hostAddress
                    }
                }
            }
        } catch (_: Exception) {}
        return null
    }

    companion object {
        private const val SERVICE_TYPE = "_geniusfiles._tcp."

        // ─── Protocole v3 ─────────────────────────────────────────
        internal const val PROTO_VERSION = 3
        internal const val RECONNECT_WINDOW_MS = 30_000L
        // Tags sender → receiver
        internal const val TAG_END: Byte = 0
        internal const val TAG_FILE: Byte = 1
        internal const val TAG_MANIFEST: Byte = 2
        // Réponses receiver → sender
        internal const val RSP_ACK_OK: Byte = 1
        internal const val RSP_ACK_RETRY: Byte = 2
        internal const val RSP_MANIFEST_ACK: Byte = 3
        internal const val RSP_CTRL_PAUSE: Byte = 4
        internal const val RSP_CTRL_RESUME: Byte = 5


        /**
         * Shared session table. Kept on the companion so
         * `TransferActionReceiver` (Pause / Resume / Cancel from the
         * persistent notification) can reach the running handle even
         * when the WebView / plugin instance has been destroyed.
         */
        internal val SESSIONS = ConcurrentHashMap<String, SessionHandle>()

        /** Décisions « Accepter / Refuser » de l'appairage local, par session. */
        internal val APPROVALS = ConcurrentHashMap<String, Boolean>()

        @Volatile
        private var INSTANCE: GeniusFilesTransferPlugin? = null

        @JvmStatic
        fun pauseById(id: String) {
            SESSIONS[id]?.let {
                it.paused.set(true)
                val out = it.controlOut
                if (out != null) {
                    try { synchronized(out) { out.writeByte(RSP_CTRL_PAUSE.toInt()); out.flush() } } catch (_: Exception) {}
                }
                INSTANCE?.pushNotification(it)
            }
        }

        @JvmStatic
        fun resumeById(id: String) {
            SESSIONS[id]?.let {
                it.paused.set(false)
                val out = it.controlOut
                if (out != null) {
                    try { synchronized(out) { out.writeByte(RSP_CTRL_RESUME.toInt()); out.flush() } } catch (_: Exception) {}
                }
                INSTANCE?.pushNotification(it)
            }
        }


        @JvmStatic
        fun cancelById(id: String) {
            val h = SESSIONS[id] ?: return
            h.cancelled.set(true)
            try { h.socket?.close() } catch (_: Exception) {}
            try { h.server?.close() } catch (_: Exception) {}
        }
    }
}
