package app.geniusfiles.mobile

import android.content.Context
import android.content.Intent
import android.text.format.DateUtils
import android.widget.RemoteViews
import android.widget.RemoteViewsService

/**
 * Fournit les lignes du widget « Fichiers récents ». Chaque appel à
 * `onDataSetChanged` relit MediaStore : la liste est mesurée, jamais devinée.
 */
class RecentFilesWidgetService : RemoteViewsService() {
    override fun onGetViewFactory(intent: Intent): RemoteViewsFactory =
        RecentFilesFactory(applicationContext)
}

private const val MAX_ROWS = 12

private class RecentFilesFactory(private val context: Context) :
    RemoteViewsService.RemoteViewsFactory {

    private var items: List<WidgetSupport.RecentFile> = emptyList()

    override fun onCreate() = Unit

    override fun onDataSetChanged() {
        items = WidgetSupport.readRecentFiles(context, MAX_ROWS)
    }

    override fun onDestroy() {
        items = emptyList()
    }

    override fun getCount(): Int = items.size

    override fun getViewAt(position: Int): RemoteViews {
        val views = RemoteViews(context.packageName, R.layout.widget_recent_item)
        val file = items.getOrNull(position) ?: return views
        views.setTextViewText(R.id.widget_item_name, file.name)
        val when0 = DateUtils.getRelativeTimeSpanString(
            file.modifiedMs,
            System.currentTimeMillis(),
            DateUtils.MINUTE_IN_MILLIS,
        )
        views.setTextViewText(
            R.id.widget_item_meta,
            WidgetSupport.formatBytes(file.size) + " · " + when0,
        )
        views.setImageViewResource(R.id.widget_item_icon, iconFor(file.mime))

        val fillIn = Intent().apply {
            putExtra(WidgetSupport.EXTRA_ROUTE, "/fichiers-recents")
            file.path?.let { putExtra("gf_path", it) }
            putExtra(WidgetSupport.EXTRA_URI, WidgetSupport.contentUriFor(file).toString())
        }
        views.setOnClickFillInIntent(R.id.widget_item_root, fillIn)
        return views
    }

    override fun getLoadingView(): RemoteViews? = null

    override fun getViewTypeCount(): Int = 1

    override fun getItemId(position: Int): Long = items.getOrNull(position)?.id ?: position.toLong()

    override fun hasStableIds(): Boolean = true

    private fun iconFor(mime: String?): Int = when {
        mime == null -> R.drawable.ic_widget_file
        mime.startsWith("image/") -> R.drawable.ic_widget_image
        mime.startsWith("video/") -> R.drawable.ic_widget_video
        mime.startsWith("audio/") -> R.drawable.ic_widget_audio
        else -> R.drawable.ic_widget_file
    }
}
