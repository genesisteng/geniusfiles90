package app.geniusfiles.mobile

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.view.View
import android.widget.RemoteViews

/**
 * Widget « Fichiers récents » — collection alimentée par MediaStore via
 * `RecentFilesWidgetService`. Les entrées dont le fichier n'existe plus sont
 * filtrées : la liste ne montre que des fichiers réellement ouvrables.
 */
class RecentFilesWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(context: Context, manager: AppWidgetManager, appWidgetIds: IntArray) {
        for (id in appWidgetIds) {
            val views = RemoteViews(context.packageName, R.layout.widget_recent)

            val adapter = Intent(context, RecentFilesWidgetService::class.java).apply {
                putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id)
                // Chaque widget doit avoir son propre RemoteViewsFactory.
                data = android.net.Uri.parse("geniusfiles://recent/$id")
            }
            views.setRemoteAdapter(R.id.widget_recent_list, adapter)
            views.setEmptyView(R.id.widget_recent_list, R.id.widget_recent_empty)

            // Modèle d'intent complété par chaque ligne (fill-in intent).
            views.setPendingIntentTemplate(
                R.id.widget_recent_list,
                WidgetSupport.launchPendingIntent(context, 40 + id, null),
            )
            views.setOnClickPendingIntent(
                R.id.widget_recent_header,
                WidgetSupport.launchPendingIntent(context, 1000 + id, "/fichiers-recents"),
            )
            views.setViewVisibility(R.id.widget_recent_list, View.VISIBLE)

            manager.updateAppWidget(id, views)
            manager.notifyAppWidgetViewDataChanged(id, R.id.widget_recent_list)
        }
    }
}
