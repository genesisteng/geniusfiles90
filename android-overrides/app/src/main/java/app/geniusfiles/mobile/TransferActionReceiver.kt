package app.geniusfiles.mobile

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Broadcast receiver behind the Pause / Resume / Cancel actions of the
 * persistent transfer notification. Delegates to the plugin's static
 * accessors — the plugin instance is the only owner of the running
 * session handles.
 */
class TransferActionReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val sessionId = intent.getStringExtra(TransferForegroundService.EXTRA_SESSION_ID)
            ?: return
        when (intent.action) {
            ACTION_PAUSE -> GeniusFilesTransferPlugin.pauseById(sessionId)
            ACTION_RESUME -> GeniusFilesTransferPlugin.resumeById(sessionId)
            ACTION_CANCEL -> GeniusFilesTransferPlugin.cancelById(sessionId)
        }
    }

    companion object {
        const val ACTION_PAUSE = "app.geniusfiles.mobile.TRANSFER_PAUSE"
        const val ACTION_RESUME = "app.geniusfiles.mobile.TRANSFER_RESUME"
        const val ACTION_CANCEL = "app.geniusfiles.mobile.TRANSFER_CANCEL"
    }
}
