package app.geniusfiles.mobile

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.provider.OpenableColumns
import android.webkit.MimeTypeMap
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.io.File
import java.util.UUID

/**
 * GeniusFilesIntent — « Ouvrir avec… » entrant.
 *
 * Quand une autre application Android demande d'ouvrir (ACTION_VIEW),
 * d'éditer (ACTION_EDIT) ou de partager (ACTION_SEND) un fichier vers
 * GeniusFiles, l'intent atterrit dans MainActivity. Ce plugin :
 *
 *  1. mémorise l'URI reçue (aucune lecture disque sur le thread UI) ;
 *  2. la résout à la demande depuis la WebView (`consume`) : chemin réel
 *     quand le fichier est accessible directement, sinon copie unique
 *     dans le cache (`cacheDir/incoming`) marquée `temporary` ;
 *  3. permet de revenir proprement à l'application appelante (`finishToCaller`)
 *     et de purger les copies temporaires (`clearTemp`).
 *
 * Aucune promesse trompeuse : si l'URI n'est pas lisible, `consume`
 * renvoie `available:false` avec un code d'erreur — jamais de crash.
 */
@CapacitorPlugin(name = "GeniusFilesIntent")
class GeniusFilesIntentPlugin : Plugin() {

    companion object {
        private const val EVENT = "incomingFile"

        /** URI en attente de résolution + action demandée. */
        @Volatile
        private var pendingUri: Uri? = null

        @Volatile
        private var pendingAction: String = "view"

        @Volatile
        private var instance: GeniusFilesIntentPlugin? = null

        /**
         * Appelé par MainActivity (onCreate / onNewIntent). Ne fait
         * qu'enregistrer l'URI : la lecture réelle a lieu dans `consume`.
         */
        @JvmStatic
        fun offer(activity: Activity, intent: Intent?) {
            val i = intent ?: return
            val action = when (i.action) {
                Intent.ACTION_EDIT -> "edit"
                Intent.ACTION_VIEW, Intent.ACTION_SEND -> "view"
                else -> return
            }
            val uri: Uri? = i.data ?: @Suppress("DEPRECATION") i.getParcelableExtra(Intent.EXTRA_STREAM)
            if (uri == null) return
            // Conserve l'autorisation de lecture accordée par l'appelant.
            try {
                activity.grantUriPermission(
                    activity.packageName,
                    uri,
                    Intent.FLAG_GRANT_READ_URI_PERMISSION,
                )
            } catch (_: Throwable) {
                /* certaines sources ne permettent pas le re-grant */
            }
            pendingUri = uri
            pendingAction = action
            instance?.notifyListeners(EVENT, JSObject().apply { put("action", action) })
        }
    }

    override fun load() {
        instance = this
        if (pendingUri != null) {
            notifyListeners(EVENT, JSObject().apply { put("action", pendingAction) })
        }
    }

    override fun handleOnDestroy() {
        if (instance === this) instance = null
        super.handleOnDestroy()
    }

    /** Y a-t-il un fichier entrant en attente ? (sans le consommer) */
    @PluginMethod
    fun hasPending(call: PluginCall) {
        call.resolve(JSObject().apply { put("pending", pendingUri != null) })
    }

    /**
     * Résout et consomme le fichier entrant. Renvoie toujours un objet :
     * `available:false` quand il n'y a rien ou que la lecture échoue.
     */
    @PluginMethod
    fun consume(call: PluginCall) {
        val uri = pendingUri
        val action = pendingAction
        pendingUri = null
        if (uri == null) {
            call.resolve(JSObject().apply { put("available", false) })
            return
        }
        try {
            val resolved = resolve(uri)
            if (resolved == null) {
                call.resolve(
                    JSObject().apply {
                        put("available", false)
                        put("error", "UNREADABLE")
                    },
                )
                return
            }
            resolved.put("available", true)
            resolved.put("action", action)
            call.resolve(resolved)
        } catch (e: Throwable) {
            call.resolve(
                JSObject().apply {
                    put("available", false)
                    put("error", e.message ?: "IO_FAILED")
                },
            )
        }
    }

    /** Retour à l'application appelante (ferme l'activité GeniusFiles). */
    @PluginMethod
    fun finishToCaller(call: PluginCall) {
        val act = activity
        if (act != null) act.runOnUiThread { act.finish() }
        call.resolve()
    }

    /** Purge les copies temporaires créées pour des URI non lisibles. */
    @PluginMethod
    fun clearTemp(call: PluginCall) {
        var removed = 0
        try {
            val dir = incomingDir()
            dir.listFiles()?.forEach { child ->
                if (child.deleteRecursively()) removed++
            }
        } catch (_: Throwable) {
            /* cache indisponible — sans conséquence */
        }
        call.resolve(JSObject().apply { put("removed", removed) })
    }

    // ── interne ───────────────────────────────────────────────────────

    private fun incomingDir(): File = File(context.cacheDir, "incoming").apply { mkdirs() }

    private fun resolve(uri: Uri): JSObject? {
        val cr = context.contentResolver
        var name: String? = null
        var size: Long = -1
        if (uri.scheme == "content") {
            try {
                cr.query(uri, null, null, null, null)?.use { c ->
                    if (c.moveToFirst()) {
                        val ni = c.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                        if (ni >= 0 && !c.isNull(ni)) name = c.getString(ni)
                        val si = c.getColumnIndex(OpenableColumns.SIZE)
                        if (si >= 0 && !c.isNull(si)) size = c.getLong(si)
                    }
                }
            } catch (_: Throwable) {
                /* fournisseur récalcitrant : on retombe sur le dernier segment */
            }
        }
        if (name.isNullOrBlank()) name = uri.lastPathSegment?.substringAfterLast('/')
        if (name.isNullOrBlank()) name = "fichier"
        val safeName = name!!.replace('/', '_')
        val mime = cr.getType(uri)
            ?: MimeTypeMap.getSingleton()
                .getMimeTypeFromExtension(safeName.substringAfterLast('.', "").lowercase())

        // 1) file:// ou content:// pointant sur un fichier réellement lisible
        val direct: File? = when {
            uri.scheme == "file" -> uri.path?.let { File(it) }
            else -> null
        }
        if (direct != null && direct.isFile && direct.canRead()) {
            return JSObject().apply {
                put("path", direct.absolutePath)
                put("name", direct.name)
                put("size", direct.length())
                put("mime", mime)
                put("temporary", false)
            }
        }

        // 2) copie unique dans le cache (aucun fichier temporaire superflu :
        //    un seul par ouverture, purgé au démarrage suivant)
        val target = File(incomingDir(), UUID.randomUUID().toString()).apply { mkdirs() }
        val out = File(target, safeName)
        cr.openInputStream(uri).use { input ->
            if (input == null) return null
            out.outputStream().use { os -> input.copyTo(os, 128 * 1024) }
        }
        if (!out.isFile) return null
        return JSObject().apply {
            put("path", out.absolutePath)
            put("name", out.name)
            put("size", if (size >= 0) size else out.length())
            put("mime", mime)
            put("temporary", true)
        }
    }
}
