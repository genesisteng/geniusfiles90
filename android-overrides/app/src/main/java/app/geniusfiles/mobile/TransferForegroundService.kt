package app.geniusfiles.mobile

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat

/**
 * Foreground service backing every active file transfer.
 *
 * Android kills background TCP work aggressively (especially on OEM
 * builds). Running the transfer inside a foreground service with a
 * persistent notification tells the OS that this work is user-visible
 * and must survive when the app is backgrounded, the screen is off, or
 * the user navigates away from the transfer route.
 *
 * The notification exposes three actions delivered via
 * `TransferActionReceiver`: Pause / Resume / Cancel. The service itself
 * doesn't run the transfer — the actual TCP work runs in
 * `GeniusFilesTransferPlugin` on an executor. The service only owns
 * the notification and the "importance" required to keep that executor
 * alive.
 */
class TransferForegroundService : Service() {

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        ensureChannel()

        val action = intent?.action ?: ACTION_UPDATE
        if (action == ACTION_STOP) {
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf(startId)
            return START_NOT_STICKY
        }

        val sessionId = intent?.getStringExtra(EXTRA_SESSION_ID).orEmpty()
        val title = intent?.getStringExtra(EXTRA_TITLE) ?: "Transfert en cours"
        val text = intent?.getStringExtra(EXTRA_TEXT) ?: "Préparation…"
        val progress = intent?.getIntExtra(EXTRA_PROGRESS, -1) ?: -1
        val paused = intent?.getBooleanExtra(EXTRA_PAUSED, false) ?: false

        val notif = buildNotification(sessionId, title, text, progress, paused)

        try {
            if (Build.VERSION.SDK_INT >= 34) {
                startForeground(
                    NOTIF_ID,
                    notif,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC,
                )
            } else {
                startForeground(NOTIF_ID, notif)
            }
        } catch (_: Exception) {
            // Older devices may throw if the permission was refused —
            // continue silently, the transfer keeps running.
        }
        return START_STICKY
    }

    private fun ensureChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (nm.getNotificationChannel(CHANNEL_ID) == null) {
            val ch = NotificationChannel(
                CHANNEL_ID,
                "Transferts en cours",
                NotificationManager.IMPORTANCE_LOW,
            ).apply {
                description = "Suivi des transferts entre appareils"
                setShowBadge(false)
            }
            nm.createNotificationChannel(ch)
        }
    }

    private fun buildNotification(
        sessionId: String,
        title: String,
        text: String,
        progress: Int,
        paused: Boolean,
    ): Notification {
        val openIntent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val openPending = PendingIntent.getActivity(
            this, 0, openIntent ?: Intent(),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val pauseAction = actionPending(
            if (paused) TransferActionReceiver.ACTION_RESUME else TransferActionReceiver.ACTION_PAUSE,
            sessionId,
            requestCode = 1,
        )
        val cancelAction = actionPending(
            TransferActionReceiver.ACTION_CANCEL,
            sessionId,
            requestCode = 2,
        )

        val icon = resources.getIdentifier("ic_stat_transfer", "drawable", packageName)
            .takeIf { it != 0 }
            ?: android.R.drawable.stat_sys_upload

        val builder = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(icon)
            .setContentTitle(title)
            .setContentText(text)
            .setOnlyAlertOnce(true)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_PROGRESS)
            .setContentIntent(openPending)
            .addAction(
                0,
                if (paused) "Reprendre" else "Pause",
                pauseAction,
            )
            .addAction(0, "Annuler", cancelAction)

        if (progress in 0..100) {
            builder.setProgress(100, progress, false)
        } else {
            builder.setProgress(0, 0, true)
        }
        return builder.build()
    }

    private fun actionPending(action: String, sessionId: String, requestCode: Int): PendingIntent {
        val intent = Intent(this, TransferActionReceiver::class.java).apply {
            this.action = action
            putExtra(EXTRA_SESSION_ID, sessionId)
            setPackage(packageName)
        }
        return PendingIntent.getBroadcast(
            this, requestCode, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }

    companion object {
        const val CHANNEL_ID = "gf_transfer"
        const val NOTIF_ID = 4211

        const val ACTION_UPDATE = "app.geniusfiles.mobile.TRANSFER_UPDATE"
        const val ACTION_STOP = "app.geniusfiles.mobile.TRANSFER_STOP"

        const val EXTRA_SESSION_ID = "sessionId"
        const val EXTRA_TITLE = "title"
        const val EXTRA_TEXT = "text"
        const val EXTRA_PROGRESS = "progress"
        const val EXTRA_PAUSED = "paused"

        /** Start / refresh the persistent notification for a running transfer. */
        fun update(
            ctx: Context,
            sessionId: String,
            title: String,
            text: String,
            progress: Int,
            paused: Boolean,
        ) {
            val i = Intent(ctx, TransferForegroundService::class.java).apply {
                action = ACTION_UPDATE
                putExtra(EXTRA_SESSION_ID, sessionId)
                putExtra(EXTRA_TITLE, title)
                putExtra(EXTRA_TEXT, text)
                putExtra(EXTRA_PROGRESS, progress)
                putExtra(EXTRA_PAUSED, paused)
            }
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    ctx.startForegroundService(i)
                } else {
                    ctx.startService(i)
                }
            } catch (_: Exception) {
                /* ignore — happens if the process is being torn down */
            }
        }

        /** Remove the persistent notification and stop the service. */
        fun stop(ctx: Context) {
            val i = Intent(ctx, TransferForegroundService::class.java).apply {
                action = ACTION_STOP
            }
            try {
                ctx.startService(i)
            } catch (_: Exception) {
                /* ignore */
            }
        }
    }
}
