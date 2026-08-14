package app.geniusfiles.mobile

import android.os.Handler
import android.os.Looper
import android.util.Log
import org.json.JSONObject
import java.io.BufferedReader
import java.io.BufferedWriter
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.InetSocketAddress
import java.net.ServerSocket
import java.net.Socket
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Canal de contrôle réel entre les deux appareils du groupe Wi-Fi Direct.
 *
 * Pourquoi ce fichier existe : la formation d'un groupe Wi-Fi P2P ne prouve
 * **rien** sur la capacité des deux appareils à échanger des données. Le
 * système peut annoncer `groupFormed = true` alors que l'adresse du
 * propriétaire de groupe n'est pas encore routable, que le pair a quitté, ou
 * que le pare-feu local bloque le port. L'ancienne implémentation passait
 * l'interface en « connecté » à cet instant : c'est la cause réelle des
 * appareils affichés comme connectés sans aucun canal fonctionnel.
 *
 * Ici, la connexion n'est déclarée prête (`ready`) qu'après :
 *   1. l'ouverture effective d'une socket TCP (le propriétaire de groupe
 *      écoute, l'autre compose l'adresse du propriétaire) ;
 *   2. un échange HELLO/WELCOME complet, qui vérifie la version de protocole
 *      et l'identité (deviceId + nom) du pair ;
 *   3. un premier aller-retour PING/PONG confirmant que les deux sens du canal
 *      fonctionnent réellement.
 *
 * Ensuite, un keepalive périodique détecte immédiatement une rupture (sortie
 * de portée, écran verrouillé, application fermée en face) et déclenche une
 * reconnexion mesurée, sans boucle agressive.
 *
 * Aucune donnée de fichier ne transite ici : ce canal ne porte que des
 * messages de contrôle, sur le lien Wi-Fi Direct déjà chiffré au niveau WPA2.
 * Les fichiers passent par la session de transfert sur son propre port.
 */
class LinkChannel(
    private val localName: String,
    private val localDeviceId: String,
    private val listen: Boolean,
    private val hostAddress: String?,
    private val events: Events,
) {

    interface Events {
        /** Socket ouverte, handshake en cours. */
        fun onAuthenticating()

        /** Handshake + aller-retour validés : le canal fonctionne réellement. */
        fun onReady(peerName: String, peerDeviceId: String)

        /**
         * Canal perdu ou impossible à ouvrir.
         *
         * `retrying` : une nouvelle tentative est planifiée.
         * `everConnected` : le canal avait réellement été établi auparavant —
         * c'est la seule situation où parler de « connexion interrompue » ou
         * de « reconnexion » a un sens. Sinon il s'agit d'un échec de
         * connexion, jamais d'une interruption.
         */
        fun onLost(message: String, retrying: Boolean, everConnected: Boolean)
    }

    private val main = Handler(Looper.getMainLooper())
    private val stopped = AtomicBoolean(false)
    private var thread: Thread? = null
    private var server: ServerSocket? = null
    private var socket: Socket? = null
    private var attempt = 0

    /** Le canal a-t-il déjà été opérationnel au moins une fois ? */
    @Volatile
    private var everConnected = false

    @Volatile
    var ready = false
        private set

    @Volatile
    var peerName: String? = null
        private set

    @Volatile
    var peerDeviceId: String? = null
        private set

    fun start() {
        if (thread != null) return
        spawn()
    }

    /** Arrêt propre : aucune socket ni thread ne survit à l'écran. */
    fun stop() {
        stopped.set(true)
        ready = false
        everConnected = false
        main.removeCallbacksAndMessages(null)
        closeQuietly()
        thread?.interrupt()
        thread = null
    }

    private fun closeQuietly() {
        try { socket?.close() } catch (_: Exception) {}
        try { server?.close() } catch (_: Exception) {}
        socket = null
        server = null
    }

    private fun spawn() {
        if (stopped.get()) return
        val t = Thread({ runOnce() }, "gf-link-channel")
        t.isDaemon = true
        thread = t
        t.start()
    }

    private fun scheduleRetry(reason: String) {
        if (stopped.get()) return
        ready = false
        attempt += 1
        val retrying = attempt <= MAX_ATTEMPTS
        // Une tentative initiale qui échoue n'est pas une « interruption » :
        // on laisse l'interface sur « connexion en cours » et on ne remonte
        // un échec qu'une fois toutes les tentatives épuisées.
        if (everConnected || !retrying) events.onLost(reason, retrying, everConnected)
        if (!retrying) return
        // Reconnexion progressive, plafonnée, pour ne pas maltraiter la
        // radio ni la batterie. Les premiers essais restent rapides.
        val delay = (600L * attempt).coerceAtMost(4_000L)
        main.postDelayed({
            thread = null
            spawn()
        }, delay)
    }

    private fun runOnce() {
        try {
            val s = if (listen) accept() else dial()
            if (s == null) {
                scheduleRetry("Canal de communication indisponible")
                return
            }
            socket = s
            s.tcpNoDelay = true
            s.soTimeout = READ_TIMEOUT_MS
            main.post { events.onAuthenticating() }
            val reader = BufferedReader(InputStreamReader(s.getInputStream(), Charsets.UTF_8))
            val writer = BufferedWriter(OutputStreamWriter(s.getOutputStream(), Charsets.UTF_8))
            if (!handshake(reader, writer)) {
                closeQuietly()
                scheduleRetry("Appareil non reconnu")
                return
            }
            attempt = 0
            ready = true
            everConnected = true
            val name = peerName ?: "Appareil GeniusFiles"
            val id = peerDeviceId ?: ""
            main.post { events.onReady(name, id) }
            pump(reader, writer)
        } catch (e: Exception) {
            if (!stopped.get()) {
                Log.w(TAG, "link channel: ${e.javaClass.simpleName}")
                closeQuietly()
                scheduleRetry("Connexion interrompue")
            }
        }
    }

    /** Le propriétaire de groupe écoute sur le port de contrôle. */
    private fun accept(): Socket? = try {
        val ss = ServerSocket()
        ss.reuseAddress = true
        ss.bind(InetSocketAddress(CONTROL_PORT), 1)
        ss.soTimeout = ACCEPT_TIMEOUT_MS
        server = ss
        val s = ss.accept()
        try { ss.close() } catch (_: Exception) {}
        server = null
        s
    } catch (_: Exception) {
        server = null
        null
    }

    /** L'autre appareil compose l'adresse du propriétaire de groupe. */
    private fun dial(): Socket? {
        val host = hostAddress ?: return null
        val deadline = System.currentTimeMillis() + DIAL_WINDOW_MS
        while (!stopped.get() && System.currentTimeMillis() < deadline) {
            try {
                val s = Socket()
                s.connect(InetSocketAddress(host, CONTROL_PORT), CONNECT_TIMEOUT_MS)
                return s
            } catch (_: Exception) {
                // Le propriétaire de groupe met parfois une seconde à écouter.
                try { Thread.sleep(300) } catch (_: InterruptedException) { return null }
            }
        }
        return null
    }

    private fun send(writer: BufferedWriter, payload: JSONObject) {
        writer.write(payload.toString())
        writer.write("\n")
        writer.flush()
    }

    /**
     * HELLO/WELCOME puis PING/PONG : la connexion n'est validée que si les
     * deux sens ont effectivement transporté un message.
     */
    private fun handshake(reader: BufferedReader, writer: BufferedWriter): Boolean {
        val hello = JSONObject().apply {
            put("t", if (listen) "welcome" else "hello")
            put("v", GeniusFilesTransferPlugin.PROTO_VERSION)
            put("name", localName)
            put("deviceId", localDeviceId)
        }
        send(writer, hello)
        val line = reader.readLine() ?: return false
        val msg = try { JSONObject(line) } catch (_: Exception) { return false }
        val type = msg.optString("t")
        if (type != "hello" && type != "welcome") return false
        if (msg.optInt("v", -1) != GeniusFilesTransferPlugin.PROTO_VERSION) return false
        val id = msg.optString("deviceId")
        if (id.isEmpty() || id == localDeviceId) return false
        peerDeviceId = id
        peerName = msg.optString("name").ifEmpty { "Appareil GeniusFiles" }
        // Vérification réelle du canal : un aller-retour complet.
        send(writer, JSONObject().apply { put("t", "ping"); put("ts", System.currentTimeMillis()) })
        val deadline = System.currentTimeMillis() + READ_TIMEOUT_MS
        while (System.currentTimeMillis() < deadline) {
            val l = reader.readLine() ?: return false
            val m = try { JSONObject(l) } catch (_: Exception) { continue }
            when (m.optString("t")) {
                "ping" -> send(writer, JSONObject().apply { put("t", "pong") })
                "pong" -> return true
            }
        }
        return false
    }

    /** Boucle keepalive : détecte une perte réelle en quelques secondes. */
    private fun pump(reader: BufferedReader, writer: BufferedWriter) {
        var lastPing = 0L
        var lastSeen = System.currentTimeMillis()
        while (!stopped.get()) {
            val now = System.currentTimeMillis()
            if (now - lastPing >= PING_INTERVAL_MS) {
                lastPing = now
                try {
                    send(writer, JSONObject().apply { put("t", "ping") })
                } catch (_: Exception) {
                    break
                }
            }
            try {
                val line = reader.readLine() ?: break
                lastSeen = System.currentTimeMillis()
                val m = try { JSONObject(line) } catch (_: Exception) { continue }
                if (m.optString("t") == "ping") {
                    send(writer, JSONObject().apply { put("t", "pong") })
                }
            } catch (_: java.net.SocketTimeoutException) {
                if (System.currentTimeMillis() - lastSeen > LIVENESS_TIMEOUT_MS) break
            } catch (_: Exception) {
                break
            }
        }
        closeQuietly()
        if (!stopped.get()) scheduleRetry("Connexion interrompue")
    }

    companion object {
        private const val TAG = "GF_TRANSFER"

        /** Port dédié au contrôle : distinct du port de transfert de fichiers. */
        const val CONTROL_PORT = 47772

        private const val ACCEPT_TIMEOUT_MS = 30_000
        private const val CONNECT_TIMEOUT_MS = 2_500
        private const val DIAL_WINDOW_MS = 25_000L
        private const val READ_TIMEOUT_MS = 8_000
        private const val PING_INTERVAL_MS = 4_000L
        private const val LIVENESS_TIMEOUT_MS = 12_000L
        private const val MAX_ATTEMPTS = 5
    }
}
