package app.geniusfiles.mobile

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.media.session.MediaSession
import android.os.Build
import android.os.IBinder
import android.util.Base64
import androidx.core.app.NotificationCompat

/**
 * Foreground service backing the GeniusFiles audio player.
 *
 * The audio itself plays inside the WebView's HTML5 <audio> element — this
 * service exists to (a) show the media notification with real Prev / Play /
 * Next / Stop action buttons, and (b) keep the WebView process alive while
 * the user backgrounds the app or locks the screen. Without a foreground
 * service, Android aggressively suspends the WebView audio pipeline.
 */
class AudioPlaybackService : Service() {

    companion object {
        const val CHANNEL_ID = "gf_audio_player"
        const val CHANNEL_NAME = "Lecture audio"
        const val NOTIF_ID = 4801

        const val ACTION_UPDATE = "app.geniusfiles.mobile.AUDIO_UPDATE"
        const val ACTION_STOP = "app.geniusfiles.mobile.AUDIO_STOP"
        const val ACTION_PLAY = "app.geniusfiles.mobile.AUDIO_PLAY"
        const val ACTION_PAUSE = "app.geniusfiles.mobile.AUDIO_PAUSE"
        const val ACTION_TOGGLE = "app.geniusfiles.mobile.AUDIO_TOGGLE"
        const val ACTION_NEXT = "app.geniusfiles.mobile.AUDIO_NEXT"
        const val ACTION_PREV = "app.geniusfiles.mobile.AUDIO_PREV"

        const val EXTRA_TITLE = "title"
        const val EXTRA_ARTIST = "artist"
        const val EXTRA_PLAYING = "playing"
        const val EXTRA_ARTWORK_B64 = "artworkBase64"

        /** Emitted by the notification's action buttons; the plugin bus forwards to JS. */
        var actionSink: ((String) -> Unit)? = null

        fun start(ctx: Context, extras: Intent.() -> Unit) {
            val i = Intent(ctx, AudioPlaybackService::class.java).apply {
                action = ACTION_UPDATE
                extras()
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) ctx.startForegroundService(i)
            else ctx.startService(i)
        }

        fun stop(ctx: Context) {
            try {
                ctx.stopService(Intent(ctx, AudioPlaybackService::class.java))
            } catch (_: Throwable) { /* ignore */ }
        }
    }

    private var mediaSession: MediaSession? = null
    private var currentTitle: String = "GeniusFiles"
    private var currentArtist: String = ""
    private var currentBitmap: Bitmap? = null
    private var isPlaying: Boolean = true

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        ensureChannel()
        try {
            mediaSession = MediaSession(this, "gf-audio")
        } catch (_: Throwable) { /* ignore */ }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val a = intent?.action ?: ACTION_UPDATE
        when (a) {
            ACTION_STOP -> {
                actionSink?.invoke("stop")
                stopSelf()
                return START_NOT_STICKY
            }
            ACTION_PLAY -> actionSink?.invoke("play")
            ACTION_PAUSE -> actionSink?.invoke("pause")
            ACTION_TOGGLE -> actionSink?.invoke("toggle")
            ACTION_NEXT -> actionSink?.invoke("next")
            ACTION_PREV -> actionSink?.invoke("prev")
        }

        // Merge new metadata (only overwrite when present)
        intent?.getStringExtra(EXTRA_TITLE)?.let { currentTitle = it }
        intent?.getStringExtra(EXTRA_ARTIST)?.let { currentArtist = it }
        if (intent?.hasExtra(EXTRA_PLAYING) == true) {
            isPlaying = intent.getBooleanExtra(EXTRA_PLAYING, true)
        }
        intent?.getStringExtra(EXTRA_ARTWORK_B64)?.let { b64 ->
            currentBitmap = decodeBase64(b64) ?: currentBitmap
        }

        val notif = buildNotification()
        try {
            startForeground(NOTIF_ID, notif)
        } catch (_: Throwable) {
            try {
                val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                nm.notify(NOTIF_ID, notif)
            } catch (_: Throwable) { /* ignore */ }
        }
        return START_STICKY
    }

    override fun onDestroy() {
        try { mediaSession?.release() } catch (_: Throwable) {}
        mediaSession = null
        try {
            val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            nm.cancel(NOTIF_ID)
        } catch (_: Throwable) {}
        super.onDestroy()
    }

    private fun ensureChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (nm.getNotificationChannel(CHANNEL_ID) == null) {
            val chan = NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                setSound(null, null)
                enableVibration(false)
                description = "Contrôles du lecteur audio GeniusFiles"
            }
            nm.createNotificationChannel(chan)
        }
    }

    private fun pi(action: String, requestCode: Int): PendingIntent {
        val i = Intent(this, AudioPlaybackService::class.java).setAction(action)
        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M)
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        else PendingIntent.FLAG_UPDATE_CURRENT
        return PendingIntent.getService(this, requestCode, i, flags)
    }

    private fun contentPendingIntent(): PendingIntent? {
        val launch = packageManager.getLaunchIntentForPackage(packageName)?.apply {
            addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            putExtra("gf_open_audio", true)
        } ?: return null
        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M)
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        else PendingIntent.FLAG_UPDATE_CURRENT
        return PendingIntent.getActivity(this, 9001, launch, flags)
    }

    private fun buildNotification(): Notification {
        val icon = applicationInfo.icon.takeIf { it != 0 } ?: android.R.drawable.ic_media_play
        val playPauseIcon = if (isPlaying) android.R.drawable.ic_media_pause else android.R.drawable.ic_media_play
        val playPauseLabel = if (isPlaying) "Pause" else "Lecture"

        val builder = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(icon)
            .setContentTitle(currentTitle)
            .setContentText(currentArtist)
            .setOnlyAlertOnce(true)
            .setOngoing(isPlaying)
            .setShowWhen(false)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_TRANSPORT)
            .setContentIntent(contentPendingIntent())
            .setDeleteIntent(pi(ACTION_STOP, 5))
            .addAction(android.R.drawable.ic_media_previous, "Précédent", pi(ACTION_PREV, 1))
            .addAction(playPauseIcon, playPauseLabel, pi(ACTION_TOGGLE, 2))
            .addAction(android.R.drawable.ic_media_next, "Suivant", pi(ACTION_NEXT, 3))
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Arrêter", pi(ACTION_STOP, 4))

        currentBitmap?.let { builder.setLargeIcon(it) }

        // Framework MediaStyle keeps the compact-view actions Prev/Play/Next
        // and the cancel button appears bottom-right on Android 5+ lock screens.
        try {
            val token = mediaSession?.sessionToken
            val style = Notification.MediaStyle()
                .setShowActionsInCompactView(0, 1, 2)
            if (token != null) style.setMediaSession(token)
            builder.setStyle(
                @Suppress("RestrictedApi")
                androidx.core.app.NotificationCompat.DecoratedCustomViewStyle()
            )
            // Prefer the platform MediaStyle when available — replaces the style above.
            val notifBuilder = builder.build()
            // Rebuild using platform Notification.Builder to attach MediaStyle
            // (NotificationCompat can't apply framework MediaStyle directly on
            // all API levels reliably; use platform builder for compatibility).
            val plat = Notification.Builder(this, CHANNEL_ID)
                .setSmallIcon(icon)
                .setContentTitle(currentTitle)
                .setContentText(currentArtist)
                .setOnlyAlertOnce(true)
                .setOngoing(isPlaying)
                .setShowWhen(false)
                .setVisibility(Notification.VISIBILITY_PUBLIC)
                .setCategory(Notification.CATEGORY_TRANSPORT)
                .setContentIntent(contentPendingIntent())
                .setDeleteIntent(pi(ACTION_STOP, 5))
                .setStyle(style)
            currentBitmap?.let { plat.setLargeIcon(it) }
            plat.addAction(
                Notification.Action.Builder(
                    android.graphics.drawable.Icon.createWithResource(this, android.R.drawable.ic_media_previous),
                    "Précédent", pi(ACTION_PREV, 1)
                ).build()
            )
            plat.addAction(
                Notification.Action.Builder(
                    android.graphics.drawable.Icon.createWithResource(this, playPauseIcon),
                    playPauseLabel, pi(ACTION_TOGGLE, 2)
                ).build()
            )
            plat.addAction(
                Notification.Action.Builder(
                    android.graphics.drawable.Icon.createWithResource(this, android.R.drawable.ic_media_next),
                    "Suivant", pi(ACTION_NEXT, 3)
                ).build()
            )
            plat.addAction(
                Notification.Action.Builder(
                    android.graphics.drawable.Icon.createWithResource(this, android.R.drawable.ic_menu_close_clear_cancel),
                    "Arrêter", pi(ACTION_STOP, 4)
                ).build()
            )
            return plat.build()
            // notifBuilder unused — swallowed intentionally
            @Suppress("UNREACHABLE_CODE") notifBuilder
        } catch (_: Throwable) {
            return builder.build()
        }
    }

    private fun decodeBase64(b64: String): Bitmap? = try {
        val raw = b64.substringAfter(",", b64)
        val bytes = Base64.decode(raw, Base64.DEFAULT)
        BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
    } catch (_: Throwable) { null }
}
