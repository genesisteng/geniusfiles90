package app.geniusfiles.mobile

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import org.json.JSONObject
import java.util.Calendar

/**
 * Native scheduling backend for GeniusFiles automations.
 *
 * Alarms are set via AlarmManager.setExactAndAllowWhileIdle so they fire
 * even when the app is closed, backgrounded, or the phone is dozing.
 * Every scheduled alarm is persisted in SharedPreferences so
 * AutomationBootReceiver can rearm them after a reboot.
 *
 * The receiver posts a Android notification directly — no WebView needed
 * — which is what makes automation notifications independent of whether
 * GeniusFiles is running.
 */
object AutomationAlarmScheduler {
    const val PREFS = "gf_automation_alarms"
    const val ACTION_FIRE = "app.geniusfiles.mobile.AUTOMATION_FIRE"
    const val CHANNEL_ID = "gf_automations"
    const val CHANNEL_NAME = "Automatisations"

    fun prefs(ctx: Context): SharedPreferences =
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun ensureChannel(ctx: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (nm.getNotificationChannel(CHANNEL_ID) == null) {
            val chan = NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_HIGH,
            )
            chan.description = "Exécutions d'automatisations GeniusFiles"
            chan.enableLights(true)
            chan.enableVibration(true)
            nm.createNotificationChannel(chan)
        }
    }

    private fun pendingIntent(ctx: Context, id: String, notifId: Int): PendingIntent {
        val intent = Intent(ctx, AutomationAlarmReceiver::class.java).apply {
            action = ACTION_FIRE
            // Data URI makes the intent unique per automation so
            // FLAG_UPDATE_CURRENT does not clobber other alarms.
            data = android.net.Uri.parse("gfauto://$id")
            putExtra("automationId", id)
            putExtra("notifId", notifId)
        }
        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M)
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        else PendingIntent.FLAG_UPDATE_CURRENT
        return PendingIntent.getBroadcast(ctx, notifId, intent, flags)
    }

    /** Schedule (or reschedule) an exact alarm for [payload]. */
    fun schedule(ctx: Context, payload: JSONObject) {
        val id = payload.getString("id")
        val atMs = payload.getLong("atMs")
        val notifId = payload.optInt("notifId", stableNotifId(id))
        payload.put("notifId", notifId)
        prefs(ctx).edit().putString(id, payload.toString()).apply()
        if (atMs <= System.currentTimeMillis()) return

        val am = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val pi = pendingIntent(ctx, id, notifId)
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !am.canScheduleExactAlarms()) {
                // Cannot use exact alarm — fall back to a non-exact one so
                // the automation still fires (a few minutes late is OK).
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, atMs, pi)
            } else {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, atMs, pi)
            }
        } catch (_: SecurityException) {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, atMs, pi)
        }
    }

    fun cancel(ctx: Context, id: String) {
        val stored = prefs(ctx).getString(id, null)
        val notifId = stored?.let {
            try { JSONObject(it).optInt("notifId", stableNotifId(id)) } catch (_: Throwable) { stableNotifId(id) }
        } ?: stableNotifId(id)
        val am = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        am.cancel(pendingIntent(ctx, id, notifId))
        prefs(ctx).edit().remove(id).apply()
    }

    fun cancelAll(ctx: Context) {
        val p = prefs(ctx)
        val ids = p.all.keys.toList()
        for (id in ids) cancel(ctx, id)
    }

    /** Re-arm every persisted alarm — called from BootReceiver. */
    fun rearmAll(ctx: Context) {
        val p = prefs(ctx)
        val now = System.currentTimeMillis()
        for ((id, raw) in p.all.toMap()) {
            val json = try { JSONObject(raw as String) } catch (_: Throwable) { continue }
            var atMs = json.optLong("atMs", 0)
            val repeat = json.optString("repeat", "once")
            if (atMs < now) {
                if (repeat == "once") {
                    p.edit().remove(id).apply()
                    continue
                }
                atMs = computeNextFire(json, now)
                json.put("atMs", atMs)
            }
            schedule(ctx, json)
        }
    }

    /** Compute next fire time for daily/weekly repeats after [afterMs]. */
    fun computeNextFire(payload: JSONObject, afterMs: Long): Long {
        val hour = payload.optInt("hour", 9)
        val minute = payload.optInt("minute", 0)
        val repeat = payload.optString("repeat", "once")
        val daysMask = payload.optInt("daysMask", 0)
        val cal = Calendar.getInstance()
        cal.timeInMillis = afterMs
        cal.set(Calendar.SECOND, 0)
        cal.set(Calendar.MILLISECOND, 0)
        cal.set(Calendar.HOUR_OF_DAY, hour)
        cal.set(Calendar.MINUTE, minute)
        // Advance until strictly in the future AND matching day-of-week (for weekly).
        for (i in 0 until 8) {
            if (cal.timeInMillis > afterMs) {
                if (repeat != "weekly") return cal.timeInMillis
                // Calendar.DAY_OF_WEEK: Sunday=1..Saturday=7. Our mask uses 0=Sun..6=Sat.
                val dayIdx = cal.get(Calendar.DAY_OF_WEEK) - 1
                if ((daysMask shr dayIdx) and 1 == 1) return cal.timeInMillis
            }
            cal.add(Calendar.DAY_OF_MONTH, 1)
        }
        return cal.timeInMillis
    }

    fun stableNotifId(id: String): Int {
        // Positive 31-bit hash so each automation gets its own notification.
        return (id.hashCode() and 0x7fffffff) or 1
    }

    fun buildNotification(ctx: Context, title: String, body: String, route: String?): android.app.Notification {
        ensureChannel(ctx)
        val launch = ctx.packageManager.getLaunchIntentForPackage(ctx.packageName)?.apply {
            addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            if (!route.isNullOrEmpty()) putExtra("gf_route", route)
        }
        val piFlags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M)
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        else PendingIntent.FLAG_UPDATE_CURRENT
        val pi = launch?.let { PendingIntent.getActivity(ctx, title.hashCode(), it, piFlags) }
        val icon = ctx.applicationInfo.icon.takeIf { it != 0 } ?: android.R.drawable.ic_dialog_info
        return NotificationCompat.Builder(ctx, CHANNEL_ID)
            .setSmallIcon(icon)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setContentIntent(pi)
            .build()
    }
}
