package app.geniusfiles.mobile

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.ContentUris
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.os.StatFs
import android.provider.MediaStore
import java.io.File

/**
 * Socle commun des widgets GeniusFiles (H10).
 *
 * Règle absolue : un widget n'affiche que des informations réellement
 * disponibles à l'instant du rafraîchissement. Aucune donnée fictive : si la
 * mesure échoue (permission absente, volume démonté), le widget affiche un
 * état vide explicite plutôt qu'une valeur inventée ou périmée.
 */
object WidgetSupport {

    const val EXTRA_ROUTE = "gf_route"
    const val EXTRA_URI = "gf_uri"
    const val EXTRA_SOURCE = "gf_source"

    data class Storage(val total: Long, val free: Long) {
        val used: Long get() = (total - free).coerceAtLeast(0L)
        val usedPercent: Int
            get() = if (total <= 0L) 0 else ((used * 100.0) / total).toInt().coerceIn(0, 100)
    }

    data class RecentFile(
        val id: Long,
        val name: String,
        val path: String?,
        val size: Long,
        val mime: String?,
        val modifiedMs: Long,
    )

    /** Mesure réelle du stockage interne ; `null` si le volume est illisible. */
    fun readStorage(): Storage? = try {
        val root = Environment.getExternalStorageDirectory() ?: Environment.getDataDirectory()
        val fs = StatFs(root.absolutePath)
        val total = fs.blockCountLong * fs.blockSizeLong
        val free = fs.availableBlocksLong * fs.blockSizeLong
        if (total <= 0L) null else Storage(total, free)
    } catch (_: Throwable) {
        null
    }

    /**
     * Derniers fichiers réellement indexés par MediaStore. Liste vide quand
     * l'autorisation manque : l'appelant affiche alors l'état vide.
     */
    fun readRecentFiles(context: Context, limit: Int): List<RecentFile> {
        val out = ArrayList<RecentFile>(limit)
        val collection = MediaStore.Files.getContentUri("external")
        val columns = arrayOf(
            MediaStore.Files.FileColumns._ID,
            MediaStore.Files.FileColumns.DISPLAY_NAME,
            MediaStore.Files.FileColumns.DATA,
            MediaStore.Files.FileColumns.SIZE,
            MediaStore.Files.FileColumns.MIME_TYPE,
            MediaStore.Files.FileColumns.DATE_MODIFIED,
        )
        val selection = MediaStore.Files.FileColumns.MIME_TYPE + " IS NOT NULL"
        val sort = MediaStore.Files.FileColumns.DATE_MODIFIED + " DESC"
        try {
            context.contentResolver.query(collection, columns, selection, null, sort)?.use { c ->
                val idIdx = c.getColumnIndexOrThrow(MediaStore.Files.FileColumns._ID)
                val nameIdx = c.getColumnIndexOrThrow(MediaStore.Files.FileColumns.DISPLAY_NAME)
                val dataIdx = c.getColumnIndexOrThrow(MediaStore.Files.FileColumns.DATA)
                val sizeIdx = c.getColumnIndexOrThrow(MediaStore.Files.FileColumns.SIZE)
                val mimeIdx = c.getColumnIndexOrThrow(MediaStore.Files.FileColumns.MIME_TYPE)
                val dateIdx = c.getColumnIndexOrThrow(MediaStore.Files.FileColumns.DATE_MODIFIED)
                while (c.moveToNext() && out.size < limit) {
                    val path = if (c.isNull(dataIdx)) null else c.getString(dataIdx)
                    // Un fichier supprimé peut rester indexé quelques minutes :
                    // on l'écarte pour ne jamais afficher une entrée morte.
                    if (path != null && !File(path).isFile) continue
                    val name = (if (c.isNull(nameIdx)) null else c.getString(nameIdx))
                        ?: path?.substringAfterLast('/')
                        ?: continue
                    out.add(
                        RecentFile(
                            id = c.getLong(idIdx),
                            name = name,
                            path = path,
                            size = if (c.isNull(sizeIdx)) 0L else c.getLong(sizeIdx),
                            mime = if (c.isNull(mimeIdx)) null else c.getString(mimeIdx),
                            modifiedMs = c.getLong(dateIdx) * 1000L,
                        ),
                    )
                }
            }
        } catch (_: Throwable) {
            return emptyList()
        }
        return out
    }

    fun contentUriFor(file: RecentFile): Uri =
        ContentUris.withAppendedId(MediaStore.Files.getContentUri("external"), file.id)

    /** « 12,4 Go » — même famille d'unités que l'interface web. */
    fun formatBytes(bytes: Long): String {
        if (bytes <= 0L) return "0 o"
        val units = arrayOf("o", "Ko", "Mo", "Go", "To")
        var value = bytes.toDouble()
        var idx = 0
        while (value >= 1024.0 && idx < units.size - 1) {
            value /= 1024.0
            idx++
        }
        val digits = if (value >= 100.0 || idx == 0) 0 else 1
        return String.format("%." + digits + "f %s", value, units[idx])
    }

    private fun pendingFlags(): Int =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        } else {
            PendingIntent.FLAG_UPDATE_CURRENT
        }

    /** Intent d'ouverture de l'application sur une route donnée. */
    fun launchIntent(context: Context, route: String?, uri: Uri? = null): Intent {
        val intent = context.packageManager.getLaunchIntentForPackage(context.packageName)
            ?: Intent(context, MainActivity::class.java)
        intent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        intent.putExtra(EXTRA_SOURCE, "widget")
        if (!route.isNullOrEmpty()) intent.putExtra(EXTRA_ROUTE, route)
        if (uri != null) intent.putExtra(EXTRA_URI, uri.toString())
        // Données distinctes par cible : sans cela Android réutiliserait le
        // même PendingIntent pour tous les boutons du widget.
        intent.action = "app.geniusfiles.mobile.WIDGET_OPEN"
        intent.data = Uri.parse(
            "geniusfiles://widget" + (route ?: "/") + "?u=" + (uri?.toString() ?: ""),
        )
        return intent
    }

    fun launchPendingIntent(
        context: Context,
        requestCode: Int,
        route: String?,
        uri: Uri? = null,
    ): PendingIntent = PendingIntent.getActivity(
        context,
        requestCode,
        launchIntent(context, route, uri),
        pendingFlags(),
    )

    /** Rafraîchit tous les widgets posés sur l'écran d'accueil. */
    fun refreshAll(context: Context) {
        val mgr = AppWidgetManager.getInstance(context) ?: return
        val providers = arrayOf(
            StorageWidgetProvider::class.java,
            QuickAccessWidgetProvider::class.java,
            RecentFilesWidgetProvider::class.java,
        )
        for (provider in providers) {
            val ids = try {
                mgr.getAppWidgetIds(ComponentName(context, provider))
            } catch (_: Throwable) {
                continue
            }
            if (ids == null || ids.isEmpty()) continue
            context.sendBroadcast(
                Intent(context, provider).apply {
                    action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
                    putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
                },
            )
            if (provider == RecentFilesWidgetProvider::class.java) {
                try {
                    mgr.notifyAppWidgetViewDataChanged(ids, R.id.widget_recent_list)
                } catch (_: Throwable) {
                    /* collection pas encore attachée */
                }
            }
        }
    }
}
