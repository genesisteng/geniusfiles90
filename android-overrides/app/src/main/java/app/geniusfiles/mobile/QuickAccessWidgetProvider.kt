package app.geniusfiles.mobile

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.widget.RemoteViews

/**
 * Widget « Accès rapide » — quatre destinations réelles de l'application,
 * atteintes en un seul appui depuis l'écran d'accueil : parcourir, chercher,
 * coffre-fort, nettoyeur. Aucun état affiché, donc rien qui puisse être
 * obsolète.
 */
class QuickAccessWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(context: Context, manager: AppWidgetManager, appWidgetIds: IntArray) {
        for (id in appWidgetIds) {
            manager.updateAppWidget(id, build(context))
        }
    }

    private fun build(context: Context): RemoteViews {
        val views = RemoteViews(context.packageName, R.layout.widget_quick_access)
        val targets = listOf(
            Triple(R.id.widget_qa_browse, 31, "/"),
            Triple(R.id.widget_qa_search, 32, "/recherche"),
            Triple(R.id.widget_qa_vault, 33, "/coffre-fort"),
            Triple(R.id.widget_qa_clean, 34, "/nettoyeur"),
        )
        for ((viewId, code, route) in targets) {
            views.setOnClickPendingIntent(
                viewId,
                WidgetSupport.launchPendingIntent(context, code, route),
            )
        }
        return views
    }
}
