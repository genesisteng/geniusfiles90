package app.geniusfiles.mobile

import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import org.json.JSONObject

/**
 * Fires when an automation's scheduled moment arrives. Posts the
 * notification directly (no WebView, no Activity) so the user is
 * notified even when GeniusFiles is closed, backgrounded, or the
 * screen is locked. For daily/weekly automations the next occurrence
 * is rearmed immediately.
 */
class AutomationAlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val ctx = context.applicationContext
        val id = intent.getStringExtra("automationId") ?: return
        val stored = AutomationAlarmScheduler.prefs(ctx).getString(id, null) ?: return
        val payload = try { JSONObject(stored) } catch (_: Throwable) { return }

        val title = payload.optString("title", "Automatisation")
        val body = payload.optString("body", "Exécution planifiée")
        val route = payload.optString("route", "/automatisations")
        val notifId = payload.optInt("notifId", AutomationAlarmScheduler.stableNotifId(id))

        try {
            val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            nm.notify(notifId, AutomationAlarmScheduler.buildNotification(ctx, title, body, route))
        } catch (_: Throwable) {
            /* notification permission denied — silently ignore */
        }

        // Mark last-fire timestamp so JS can tell native runs from in-app runs.
        payload.put("lastFireMs", System.currentTimeMillis())

        val repeat = payload.optString("repeat", "once")
        if (repeat == "once") {
            AutomationAlarmScheduler.prefs(ctx).edit().remove(id).apply()
            return
        }

        // Reschedule the next occurrence for daily / weekly repeats.
        val next = AutomationAlarmScheduler.computeNextFire(payload, System.currentTimeMillis() + 60_000)
        payload.put("atMs", next)
        AutomationAlarmScheduler.schedule(ctx, payload)
    }
}
