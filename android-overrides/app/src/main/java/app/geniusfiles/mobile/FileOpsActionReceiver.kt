package app.geniusfiles.mobile

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.getcapacitor.JSObject

/**
 * Actions des notifications de copie / déplacement : « Annuler » pendant
 * la tâche, « Ouvrir le dossier » une fois terminée.
 *
 * L'ouverture fonctionne même application fermée : le chemin est persisté
 * puis relu par le JS au démarrage (`consumePendingOpenPath`).
 */
class FileOpsActionReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            ACTION_CANCEL -> intent.getStringExtra("id")?.let { FileOpsService.cancel(it) }
            ACTION_OPEN_DEST -> {
                val path = intent.getStringExtra("path").orEmpty()
                if (path.isNotEmpty()) {
                    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                        .edit().putString(KEY_PENDING_PATH, path).apply()
                    FileOpsService.listener?.invoke(
                        "fileOpOpenDestination",
                        JSObject().put("path", path),
                    )
                }
                try {
                    val launch = context.packageManager
                        .getLaunchIntentForPackage(context.packageName)
                    launch?.addFlags(
                        Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP,
                    )
                    if (launch != null) context.startActivity(launch)
                } catch (_: Throwable) {
                }
            }
        }
    }

    companion object {
        const val ACTION_CANCEL = "app.geniusfiles.mobile.FILEOPS_CANCEL"
        const val ACTION_OPEN_DEST = "app.geniusfiles.mobile.FILEOPS_OPEN_DEST"
        const val PREFS = "GeniusFilesFileOps"
        const val KEY_PENDING_PATH = "pendingOpenPath"
    }
}
