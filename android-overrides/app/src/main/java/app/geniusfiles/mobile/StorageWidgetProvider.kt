package app.geniusfiles.mobile

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.view.View
import android.widget.RemoteViews

/**
 * Widget « Stockage » — espace réellement disponible sur le volume interne.
 *
 * Mesuré à chaque mise à jour via `StatFs` : aucune valeur mémorisée, donc
 * jamais de chiffre périmé. Un appui ouvre le nettoyeur, où l'utilisateur
 * peut agir immédiatement sur l'espace occupé.
 */
class StorageWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(context: Context, manager: AppWidgetManager, appWidgetIds: IntArray) {
        for (id in appWidgetIds) {
            manager.updateAppWidget(id, build(context))
        }
    }

    private fun build(context: Context): RemoteViews {
        val views = RemoteViews(context.packageName, R.layout.widget_storage)
        val storage = WidgetSupport.readStorage()
        if (storage == null) {
            views.setViewVisibility(R.id.widget_storage_body, View.GONE)
            views.setViewVisibility(R.id.widget_storage_empty, View.VISIBLE)
        } else {
            views.setViewVisibility(R.id.widget_storage_body, View.VISIBLE)
            views.setViewVisibility(R.id.widget_storage_empty, View.GONE)
            views.setTextViewText(
                R.id.widget_storage_free,
                WidgetSupport.formatBytes(storage.free),
            )
            views.setTextViewText(
                R.id.widget_storage_detail,
                context.getString(
                    R.string.widget_storage_detail,
                    WidgetSupport.formatBytes(storage.used),
                    WidgetSupport.formatBytes(storage.total),
                ),
            )
            views.setTextViewText(
                R.id.widget_storage_percent,
                context.getString(R.string.widget_storage_percent, storage.usedPercent),
            )
            views.setProgressBar(R.id.widget_storage_bar, 100, storage.usedPercent, false)
        }
        views.setOnClickPendingIntent(R.id.widget_storage_root, open(context, 21, "/nettoyeur"))
        views.setOnClickPendingIntent(R.id.widget_storage_empty, open(context, 22, "/"))
        return views
    }

    private fun open(context: Context, code: Int, route: String): PendingIntent =
        WidgetSupport.launchPendingIntent(context, code, route)
}
