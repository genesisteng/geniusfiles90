package app.geniusfiles.mobile

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Re-arms every persisted automation alarm after the device boots or
 * the app is updated / reinstalled. Without this receiver, users would
 * need to open GeniusFiles once after every reboot for their
 * automations to fire again.
 */
class AutomationBootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action ?: return
        if (action != Intent.ACTION_BOOT_COMPLETED &&
            action != Intent.ACTION_LOCKED_BOOT_COMPLETED &&
            action != Intent.ACTION_MY_PACKAGE_REPLACED &&
            action != "android.intent.action.QUICKBOOT_POWERON"
        ) return
        try {
            AutomationAlarmScheduler.ensureChannel(context.applicationContext)
            AutomationAlarmScheduler.rearmAll(context.applicationContext)
        } catch (_: Throwable) {
            /* never crash the boot broadcast */
        }
    }
}
