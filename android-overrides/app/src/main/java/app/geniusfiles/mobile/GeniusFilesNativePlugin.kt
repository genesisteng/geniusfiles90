package app.geniusfiles.mobile

import android.Manifest
import android.app.Activity
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.AppOpsManager
import android.app.usage.StorageStatsManager
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.content.pm.ActivityInfo
import android.content.pm.ApplicationInfo
import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.drawable.Drawable
import android.media.AudioManager
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.os.Process
import android.os.StatFs
import android.os.storage.StorageManager
import android.provider.Settings
import android.view.WindowManager
import android.util.Base64
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.core.app.NotificationCompat
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import androidx.activity.result.ActivityResult
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.util.UUID
import java.util.zip.ZipEntry
import java.util.zip.ZipFile
import java.util.zip.ZipInputStream
import java.util.zip.ZipOutputStream

/**
 * GeniusFilesNative — real file-manager backend for GeniusFiles.
 *
 * Implements the surface expected by src/lib/native/geniusfiles-native.ts
 * on top of java.io.File. Requires MANAGE_EXTERNAL_STORAGE (Android 11+)
 * or legacy READ/WRITE_EXTERNAL_STORAGE (Android ≤10) to see the whole
 * /storage/emulated/0 tree.
 *
 * Errors are surfaced with short machine-readable codes so the JS layer
 * can map them to user-friendly French messages:
 *   DENIED · NOT_FOUND · NOT_A_DIRECTORY · EXISTS · IO_FAILED · UNSUPPORTED
 */
private const val LEGACY_STORAGE = "legacyStorage"
private const val EVENT_STORAGE_PERMISSION_CHANGED = "storagePermissionChanged"
private const val EVENT_STORAGE_VOLUMES_CHANGED = "storageVolumesChanged"

@CapacitorPlugin(
    name = "GeniusFilesNative",
    permissions = [
        Permission(
            strings = [Manifest.permission.READ_EXTERNAL_STORAGE, Manifest.permission.WRITE_EXTERNAL_STORAGE],
            alias = LEGACY_STORAGE
        )
    ]
)
class GeniusFilesNativePlugin : Plugin() {

    private val trashDir: File by lazy {
        File(context.filesDir, "trash").apply { mkdirs() }
    }

    /** Persiste le mode pour le prochain cold start et l'applique maintenant. */
    @PluginMethod
    fun setThemeMode(call: PluginCall) {
        val mode = call.getString("mode")
        if (mode != "system" && mode != "light" && mode != "dark") {
            call.reject("BAD_ARGS", "mode must be system, light or dark")
            return
        }
        context.getSharedPreferences(MainActivity.THEME_PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(MainActivity.THEME_MODE, mode)
            // Le choix doit être sur disque avant de confirmer à la WebView :
            // même un arrêt forcé juste après le tap conserve le bon thème.
            .commit()

        activity.runOnUiThread {
            // Le thème réel du téléphone : `Resources.getSystem()` n'est pas
            // affecté par un éventuel mode nuit forcé côté application.
            val systemLight = (activity as? MainActivity)?.isSystemLight()
                ?: ((android.content.res.Resources.getSystem().configuration.uiMode and
                    Configuration.UI_MODE_NIGHT_MASK) != Configuration.UI_MODE_NIGHT_YES)
            val light = when (mode) {
                "light" -> true
                "dark" -> false
                else -> systemLight
            }
            // Ne pas appeler setDefaultNightMode ici : AppCompat recréerait
            // l'Activity, produisant l'écran noir et détruisant l'état courant.
            (activity as? MainActivity)?.applySystemBars(light)
            // Le cookie lu par le script de pré-peinture doit refléter le
            // nouveau choix dès le prochain démarrage.
            (activity as? MainActivity)?.publishThemeCookies()
            call.resolve()
        }
    }

    /** Mode persisté + thème réel du téléphone (source de vérité du mode auto). */
    @PluginMethod
    fun getThemeState(call: PluginCall) {
        val main = activity as? MainActivity
        val mode = main?.savedThemeMode()
            ?: context.getSharedPreferences(MainActivity.THEME_PREFS, Context.MODE_PRIVATE)
                .getString(MainActivity.THEME_MODE, "system") ?: "system"
        val systemLight = main?.isSystemLight()
            ?: ((android.content.res.Resources.getSystem().configuration.uiMode and
                Configuration.UI_MODE_NIGHT_MASK) != Configuration.UI_MODE_NIGHT_YES)
        val res = JSObject()
        res.put("mode", mode)
        res.put("systemLight", systemLight)
        call.resolve(res)
    }

    /** Applique immédiatement le contraste calculé par la WebView hydratée. */
    @PluginMethod
    fun applySystemBarTheme(call: PluginCall) {
        val light = call.getBoolean("light") ?: false
        activity.runOnUiThread {
            (activity as? MainActivity)?.applySystemBars(light)
            call.resolve()
        }
    }
    private val trashIndex: File by lazy { File(trashDir, "_index.json") }

    // -------- Storage volumes (SD card / USB OTG) --------

    private var mediaReceiver: android.content.BroadcastReceiver? = null

    override fun load() {
        super.load()
        registerMediaReceiver()
    }

    override fun handleOnDestroy() {
        try { mediaReceiver?.let { context.unregisterReceiver(it) } } catch (_: Throwable) {}
        mediaReceiver = null
        super.handleOnDestroy()
    }

    private fun registerMediaReceiver() {
        if (mediaReceiver != null) return
        val filter = android.content.IntentFilter().apply {
            addAction(Intent.ACTION_MEDIA_MOUNTED)
            addAction(Intent.ACTION_MEDIA_UNMOUNTED)
            addAction(Intent.ACTION_MEDIA_EJECT)
            addAction(Intent.ACTION_MEDIA_REMOVED)
            addAction(Intent.ACTION_MEDIA_BAD_REMOVAL)
            addDataScheme("file")
        }
        mediaReceiver = object : android.content.BroadcastReceiver() {
            override fun onReceive(ctx: Context, intent: Intent) {
                try { notifyListeners(EVENT_STORAGE_VOLUMES_CHANGED, collectVolumesPayload(), true) } catch (_: Throwable) {}
            }
        }
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                context.registerReceiver(mediaReceiver, filter, Context.RECEIVER_EXPORTED)
            } else {
                context.registerReceiver(mediaReceiver, filter)
            }
        } catch (_: Throwable) {}
    }

    private fun collectVolumesPayload(): JSObject {
        val arr = JSArray()
        val primary = Environment.getExternalStorageDirectory().absolutePath
        val sm = context.getSystemService(Context.STORAGE_SERVICE) as? StorageManager
        val seen = HashSet<String>()
        if (sm != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            for (v in sm.storageVolumes) {
                val path: String = try {
                    // Reflection: getPath() is public but was hidden in some AOSPs.
                    val m = v.javaClass.getMethod("getPath")
                    (m.invoke(v) as? String) ?: continue
                } catch (_: Throwable) { continue }
                if (!seen.add(path)) continue
                val entry = describeVolume(path, v.isPrimary, v.isRemovable, v.state, v.getDescription(context), v.uuid)
                arr.put(entry)
            }
        }
        if (!seen.contains(primary)) {
            arr.put(describeVolume(primary, true, false, "mounted", "Stockage interne", null))
        }
        // Probe /storage for any volume the StorageManager missed (some ROMs hide USB OTG).
        val storageDir = File("/storage")
        val ignored = setOf("emulated", "self", "enc_emulated", "container")
        try {
            storageDir.listFiles()?.forEach { child ->
                if (!child.isDirectory) return@forEach
                if (ignored.contains(child.name)) return@forEach
                val abs = child.absolutePath
                if (!seen.add(abs)) return@forEach
                val readable = try { child.canRead() && (child.list() != null) } catch (_: Throwable) { false }
                if (!readable) return@forEach
                arr.put(describeVolume(abs, false, true, "mounted", child.name, null))
            }
        } catch (_: Throwable) {}
        val out = JSObject()
        out.put("volumes", arr)
        return out
    }

    private fun describeVolume(path: String, primary: Boolean, removable: Boolean, state: String?, label: String?, uuid: String?): JSObject {
        val obj = JSObject()
        obj.put("path", path)
        obj.put("primary", primary)
        obj.put("removable", removable)
        obj.put("state", state ?: "unknown")
        obj.put("label", label ?: (if (primary) "Stockage interne" else File(path).name))
        if (uuid != null) obj.put("uuid", uuid)
        try {
            val stat = StatFs(path)
            val total = stat.blockCountLong * stat.blockSizeLong
            val free = stat.availableBlocksLong * stat.blockSizeLong
            obj.put("total", total)
            obj.put("free", free)
            obj.put("used", total - free)
        } catch (_: Throwable) {
            obj.put("total", 0)
            obj.put("free", 0)
            obj.put("used", 0)
        }
        // Heuristic: 4-hex-dash-4-hex UUIDs are SD cards; otherwise assume USB when removable.
        val name = File(path).name
        val kind = when {
            primary -> "internal"
            name.matches(Regex("^[A-Fa-f0-9]{4}-?[A-Fa-f0-9]{4}$")) -> "sdcard"
            removable -> "usb"
            else -> "external"
        }
        obj.put("kind", kind)
        return obj
    }

    @PluginMethod
    fun listStorageVolumes(call: PluginCall) {
        call.resolve(collectVolumesPayload())
    }

    @PluginMethod
    fun getVolumeStats(call: PluginCall) {
        val path = call.getString("path") ?: return call.reject("BAD_ARGS", "path required")
        try {
            val stat = StatFs(path)
            val total = stat.blockCountLong * stat.blockSizeLong
            val free = stat.availableBlocksLong * stat.blockSizeLong
            val out = JSObject()
            out.put("path", path)
            out.put("total", total)
            out.put("free", free)
            out.put("used", total - free)
            call.resolve(out)
        } catch (e: Throwable) {
            call.reject("IO_FAILED", e.message)
        }
    }

    // -------- Permission --------

    override fun handleOnResume() {
        super.handleOnResume()
        notifyStoragePermissionChanged()
    }

    @PluginMethod
    fun checkAllFilesAccess(call: PluginCall) {
        call.resolve(storagePermissionPayload())
    }

    @PluginMethod
    fun requestAllFilesAccess(call: PluginCall) {
        if (hasAllFilesAccess()) {
            val out = storagePermissionPayload(openedSettings = false, destination = "already_granted")
            notifyStoragePermissionChanged()
            call.resolve(out)
            return
        }

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
            requestLegacyStorageAccess(call)
            return
        }

        val openedDestination = openBestStorageSettingsPage()
        if (openedDestination != null) {
            val out = storagePermissionPayload(openedSettings = true, destination = openedDestination)
            call.resolve(out)
            return
        }

        call.reject(
            "Impossible d'ouvrir les paramètres Android pour accorder l'accès aux fichiers.",
            "SETTINGS_UNAVAILABLE"
        )
    }

    @PermissionCallback
    private fun legacyStorageCallback(call: PluginCall) {
        val out = storagePermissionPayload(openedSettings = false, destination = "runtime_permission")
        notifyStoragePermissionChanged()
        call.resolve(out)
    }

    private fun requestLegacyStorageAccess(call: PluginCall) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M || hasAllFilesAccess()) {
            call.resolve(storagePermissionPayload(openedSettings = false, destination = "already_granted"))
            return
        }

        if (activity == null || getPermissionState(LEGACY_STORAGE) == PermissionState.GRANTED) {
            val opened = openApplicationDetailsSettings() ?: openSystemSettings()
            if (opened != null) {
                call.resolve(storagePermissionPayload(openedSettings = true, destination = opened))
                return
            }
            call.reject(
                "Impossible d'ouvrir les paramètres Android pour accorder l'accès aux fichiers.",
                "SETTINGS_UNAVAILABLE"
            )
            return
        }

        requestPermissionForAlias(LEGACY_STORAGE, call, "legacyStorageCallback")
    }

    private fun hasAllFilesAccess(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            Environment.isExternalStorageManager()
        } else {
            hasLegacyStorageAccess()
        }
    }

    private fun hasLegacyStorageAccess(): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return true
        val readGranted = ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.READ_EXTERNAL_STORAGE
        ) == PackageManager.PERMISSION_GRANTED
        val writeGranted = if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.Q) {
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.WRITE_EXTERNAL_STORAGE
            ) == PackageManager.PERMISSION_GRANTED
        } else {
            true
        }
        return readGranted && writeGranted
    }

    private fun storagePermissionPayload(
        openedSettings: Boolean = false,
        destination: String? = null
    ): JSObject {
        val granted = hasAllFilesAccess()
        val out = JSObject()
        out.put("granted", granted)
        out.put("sdk", Build.VERSION.SDK_INT)
        out.put("requiresSettings", Build.VERSION.SDK_INT >= Build.VERSION_CODES.R)
        out.put("openedSettings", openedSettings)
        destination?.let { out.put("destination", it) }
        return out
    }

    private fun notifyStoragePermissionChanged() {
        notifyListeners(EVENT_STORAGE_PERMISSION_CHANGED, storagePermissionPayload(), true)
    }

    private fun openBestStorageSettingsPage(): String? {
        val pkgUri = Uri.parse("package:" + context.packageName)
        val candidates = listOf(
            // Official Android 11+ per-app page. This is the ideal target:
            // the user lands directly on GeniusFiles' "manage all files" switch.
            "manage_app_all_files" to Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION).apply {
                data = pkgUri
            },
            // Fallback: official global "all files access" list. Some OEM ROMs
            // reject the app-specific URI but still expose this screen.
            "manage_all_files" to Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION),
            // Last useful app-specific fallback. It always opens GeniusFiles'
            // Android settings page, where the user can reach Permissions /
            // Special app access depending on the device skin.
            "app_details" to Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply { data = pkgUri },
            "manage_applications" to Intent(Settings.ACTION_MANAGE_APPLICATIONS_SETTINGS),
            "application_settings" to Intent(Settings.ACTION_APPLICATION_SETTINGS),
            "system_settings" to Intent(Settings.ACTION_SETTINGS)
        )
        return openFirstAvailableSettings(candidates)
    }

    private fun openApplicationDetailsSettings(): String? {
        val pkgUri = Uri.parse("package:" + context.packageName)
        return openFirstAvailableSettings(
            listOf("app_details" to Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply { data = pkgUri })
        )
    }

    private fun openSystemSettings(): String? {
        return openFirstAvailableSettings(listOf("system_settings" to Intent(Settings.ACTION_SETTINGS)))
    }

    private fun openFirstAvailableSettings(candidates: List<Pair<String, Intent>>): String? {
        val launcher = activity ?: context
        for ((name, original) in candidates) {
            try {
                val intent = Intent(original)
                intent.addCategory(Intent.CATEGORY_DEFAULT)
                if (launcher !is Activity) intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                // Do not pre-filter with resolveActivity(). On Android 11+ and
                // on several OEM ROMs, package visibility rules can make that
                // query return null even though the Settings activity opens
                // correctly. The only reliable test is to launch and catch.
                launcher.startActivity(intent)
                return name
            } catch (_: Throwable) {
                // Try the next, broader Android settings screen. This prevents
                // a silent no-op on OEM ROMs that hide one of the official pages.
            }
        }
        return null
    }

    // -------- Storage stats --------

    @PluginMethod
    fun getStorageStats(call: PluginCall) {
        try {
            val path = Environment.getExternalStorageDirectory()
            val stat = StatFs(path.absolutePath)
            val total = stat.blockCountLong * stat.blockSizeLong
            val free = stat.availableBlocksLong * stat.blockSizeLong
            val out = JSObject()
            out.put("total", total)
            out.put("free", free)
            out.put("used", total - free)
            out.put("path", path.absolutePath)
            call.resolve(out)
        } catch (e: Throwable) {
            call.reject("IO_FAILED", e.message)
        }
    }

    @PluginMethod
    fun rootPath(call: PluginCall) {
        val out = JSObject()
        out.put("path", Environment.getExternalStorageDirectory().absolutePath)
        call.resolve(out)
    }

    // -------- Listing / stat --------

    @PluginMethod
    fun listDirectory(call: PluginCall) {
        val path = call.getString("path") ?: return call.reject("BAD_ARGS", "path required")
        if (!hasAllFilesAccess()) return call.reject("DENIED", "storage permission required")
        val dir = File(path)
        if (!dir.exists()) return call.reject("NOT_FOUND", "no such directory")
        if (!dir.isDirectory) return call.reject("NOT_A_DIRECTORY", "not a directory")
        val children = try {
            dir.listFiles() ?: emptyArray()
        } catch (e: SecurityException) {
            return call.reject("DENIED", e.message)
        }
        val arr = JSArray()
        for (c in children) {
            arr.put(entryJson(c))
        }
        val out = JSObject()
        out.put("path", dir.absolutePath)
        out.put("entries", arr)
        call.resolve(out)
    }

    @PluginMethod
    fun statDirectory(call: PluginCall) {
        val path = call.getString("path") ?: return call.reject("BAD_ARGS", "path required")
        if (!hasAllFilesAccess()) return call.reject("DENIED", "storage permission required")
        val dir = File(path)
        if (!dir.exists()) return call.reject("NOT_FOUND", "no such directory")
        if (!dir.isDirectory) return call.reject("NOT_A_DIRECTORY", "not a directory")
        val count = try {
            dir.list()?.size ?: 0
        } catch (e: SecurityException) {
            return call.reject("DENIED", e.message)
        }
        val out = JSObject()
        out.put("path", dir.absolutePath)
        out.put("mtime", dir.lastModified())
        out.put("count", count)
        call.resolve(out)
    }

    @PluginMethod
    fun stat(call: PluginCall) {
        val path = call.getString("path") ?: return call.reject("BAD_ARGS", "path required")
        if (!hasAllFilesAccess()) return call.reject("DENIED", "storage permission required")
        val f = File(path)
        if (!f.exists()) return call.reject("NOT_FOUND", "no such path")
        val out = entryJson(f)
        if (f.isDirectory) {
            var count = 0L
            var size = 0L
            walk(f) { child ->
                count++
                if (!child.isDirectory) size += child.length()
            }
            out.put("recursiveSize", size)
            out.put("itemCount", count)
        }
        call.resolve(out)
    }

    // -------- Mutations --------

    @PluginMethod
    fun createDirectory(call: PluginCall) {
        val path = call.getString("path") ?: return call.reject("BAD_ARGS", "path required")
        if (!hasAllFilesAccess()) return call.reject("DENIED", "storage permission required")
        val f = File(path)
        if (f.exists()) return call.reject("EXISTS", "already exists")
        if (!f.mkdirs()) return call.reject("IO_FAILED", "mkdir failed")
        val out = JSObject(); out.put("path", f.absolutePath); call.resolve(out)
    }

    @PluginMethod
    fun renamePath(call: PluginCall) {
        val path = call.getString("path") ?: return call.reject("BAD_ARGS", "path required")
        val newName = call.getString("newName") ?: return call.reject("BAD_ARGS", "newName required")
        if (!hasAllFilesAccess()) return call.reject("DENIED", "storage permission required")
        val src = File(path)
        if (!src.exists()) return call.reject("NOT_FOUND")
        val dst = File(src.parentFile, newName)
        if (dst.exists()) return call.reject("EXISTS")
        if (!src.renameTo(dst)) return call.reject("IO_FAILED", "rename failed")
        val out = JSObject(); out.put("path", dst.absolutePath); call.resolve(out)
    }

    @PluginMethod
    fun copyFile(call: PluginCall) {
        val source = call.getString("source") ?: return call.reject("BAD_ARGS")
        val destination = call.getString("destination") ?: return call.reject("BAD_ARGS")
        val overwrite = call.getBoolean("overwrite", false) == true
        if (!hasAllFilesAccess()) return call.reject("DENIED", "storage permission required")
        val src = File(source); val dst = File(destination)
        if (!src.exists()) return call.reject("NOT_FOUND")
        if (dst.exists() && !overwrite) return call.reject("EXISTS")
        dst.parentFile?.mkdirs()
        try {
            if (src.isDirectory) copyTree(src, dst) else copyFileImpl(src, dst)
            val out = JSObject(); out.put("path", dst.absolutePath); out.put("size", dst.length()); call.resolve(out)
        } catch (e: Throwable) {
            call.reject("IO_FAILED", e.message)
        }
    }

    @PluginMethod
    fun moveFile(call: PluginCall) {
        val source = call.getString("source") ?: return call.reject("BAD_ARGS")
        val destination = call.getString("destination") ?: return call.reject("BAD_ARGS")
        val overwrite = call.getBoolean("overwrite", false) == true
        if (!hasAllFilesAccess()) return call.reject("DENIED", "storage permission required")
        val src = File(source); val dst = File(destination)
        if (!src.exists()) return call.reject("NOT_FOUND")
        if (dst.exists() && !overwrite) return call.reject("EXISTS")
        dst.parentFile?.mkdirs()
        if (dst.exists()) dst.deleteRecursively()
        if (src.renameTo(dst)) {
            val out = JSObject(); out.put("path", dst.absolutePath); call.resolve(out); return
        }
        try {
            if (src.isDirectory) copyTree(src, dst) else copyFileImpl(src, dst)
            src.deleteRecursively()
            val out = JSObject(); out.put("path", dst.absolutePath); call.resolve(out)
        } catch (e: Throwable) {
            call.reject("IO_FAILED", e.message)
        }
    }

    @PluginMethod
    fun deletePath(call: PluginCall) {
        val path = call.getString("path") ?: return call.reject("BAD_ARGS")
        if (!hasAllFilesAccess()) return call.reject("DENIED", "storage permission required")
        val f = File(path)
        if (!f.exists()) return call.resolve()
        val ok = if (f.isDirectory) deleteTreeIterative(f) else f.delete()
        if (!ok) return call.reject("IO_FAILED", "delete failed")
        call.resolve()
    }

    /**
     * Suppression récursive itérative (post-ordre), sans récursion Java.
     *
     * `File.deleteRecursively()` descend récursivement : sur une
     * arborescence très profonde (ou un lien symbolique piégé) elle peut
     * saturer la pile. Ici la pile est explicite et bornée par la mémoire
     * tas, donc un dossier de plusieurs centaines de milliers d'éléments
     * se supprime sans risque de StackOverflowError.
     */
    private fun deleteTreeIterative(root: File): Boolean {
        val stack = ArrayDeque<File>()
        val postOrder = ArrayList<File>()
        stack.addLast(root)
        while (stack.isNotEmpty()) {
            val cur = stack.removeLast()
            postOrder.add(cur)
            if (cur.isDirectory && !isSymlink(cur)) {
                cur.listFiles()?.forEach { stack.addLast(it) }
            }
        }
        var ok = true
        // Les enfants d'abord : un dossier ne peut être supprimé que vide.
        for (i in postOrder.indices.reversed()) {
            val f = postOrder[i]
            if (!f.exists()) continue
            if (!f.delete()) ok = false
        }
        return ok && !root.exists()
    }

    private fun isSymlink(f: File): Boolean = try {
        f.canonicalFile != f.absoluteFile
    } catch (e: Throwable) {
        false
    }

    /**
     * Contrôle groupé d'existence.
     *
     * Permet au JS de vérifier l'état réel du stockage après une opération
     * en un seul passage du pont natif, au lieu de N appels `stat`.
     */
    @PluginMethod
    fun existsBatch(call: PluginCall) {
        val paths = call.getArray("paths") ?: return call.reject("BAD_ARGS", "paths required")
        if (!hasAllFilesAccess()) return call.reject("DENIED", "storage permission required")
        val present = JSArray()
        val missing = JSArray()
        for (i in 0 until paths.length()) {
            val p = paths.optString(i, null) ?: continue
            val exists = try {
                File(p).exists()
            } catch (e: SecurityException) {
                false
            }
            if (exists) present.put(p) else missing.put(p)
        }
        val out = JSObject()
        out.put("present", present)
        out.put("missing", missing)
        call.resolve(out)
    }

    // -------- Trash (app-private, reversible) --------

    @PluginMethod
    fun moveToTrash(call: PluginCall) {
        val paths = call.getArray("paths") ?: return call.reject("BAD_ARGS")
        if (!hasAllFilesAccess()) return call.reject("DENIED", "storage permission required")
        val moved = JSArray(); val failed = JSArray()
        val index = readTrashIndex()
        for (i in 0 until paths.length()) {
            val p = paths.optString(i, null) ?: continue
            val src = File(p)
            if (!src.exists()) { failed.put(p); continue }
            val id = UUID.randomUUID().toString()
            val dst = File(trashDir, id)
            try {
                if (!src.renameTo(dst)) {
                    if (src.isDirectory) copyTree(src, dst) else copyFileImpl(src, dst)
                    src.deleteRecursively()
                }
                val meta = JSObject()
                meta.put("id", id)
                meta.put("originalPath", src.absolutePath)
                meta.put("name", src.name)
                meta.put("isDirectory", dst.isDirectory)
                meta.put("size", if (dst.isDirectory) folderSize(dst) else dst.length())
                meta.put("deletedAt", System.currentTimeMillis())
                index.put(meta)
                val mv = JSObject()
                mv.put("id", id); mv.put("originalPath", src.absolutePath); mv.put("trashPath", dst.absolutePath)
                moved.put(mv)
            } catch (_: Throwable) {
                failed.put(p)
            }
        }
        writeTrashIndex(index)
        val out = JSObject(); out.put("moved", moved); out.put("failed", failed); call.resolve(out)
    }

    @PluginMethod
    fun listTrash(call: PluginCall) {
        val index = readTrashIndex()
        val items = JSArray()
        var total = 0L
        for (i in 0 until index.length()) {
            val m = index.optJSONObject(i) ?: continue
            val id = m.optString("id")
            val f = File(trashDir, id)
            if (!f.exists()) continue
            val entry = JSObject()
            entry.put("id", id)
            entry.put("trashPath", f.absolutePath)
            entry.put("originalPath", m.optString("originalPath"))
            entry.put("name", m.optString("name"))
            entry.put("isDirectory", m.optBoolean("isDirectory"))
            val size = m.optLong("size", if (f.isDirectory) folderSize(f) else f.length())
            entry.put("size", size)
            entry.put("deletedAt", m.optLong("deletedAt"))
            total += size
            items.put(entry)
        }
        val out = JSObject()
        out.put("items", items)
        out.put("totalBytes", total)
        out.put("trashPath", trashDir.absolutePath)
        call.resolve(out)
    }

    @PluginMethod
    fun restoreFromTrash(call: PluginCall) {
        val items = call.getArray("items") ?: return call.reject("BAD_ARGS")
        if (!hasAllFilesAccess()) return call.reject("DENIED", "storage permission required")
        val restored = JSArray(); val failed = JSArray()
        val index = readTrashIndex()
        val keep = JSArray()
        val requested = HashMap<String, String?>()
        for (i in 0 until items.length()) {
            val obj = items.optJSONObject(i) ?: continue
            requested[obj.optString("id")] = if (obj.has("targetPath")) obj.optString("targetPath") else null
        }
        for (i in 0 until index.length()) {
            val m = index.optJSONObject(i) ?: continue
            val id = m.optString("id")
            if (!requested.containsKey(id)) { keep.put(m); continue }
            val src = File(trashDir, id)
            if (!src.exists()) {
                val fj = JSObject(); fj.put("id", id); fj.put("reason", "MISSING"); failed.put(fj); continue
            }
            val target = requested[id] ?: m.optString("originalPath").ifEmpty { null }
            if (target == null) {
                val fj = JSObject(); fj.put("id", id); fj.put("reason", "NO_TARGET"); failed.put(fj)
                keep.put(m); continue
            }
            val dst = File(target)
            val parent = dst.parentFile
            if (parent == null || (!parent.exists() && !parent.mkdirs())) {
                val fj = JSObject(); fj.put("id", id); fj.put("reason", "PARENT_MISSING"); fj.put("originalPath", target); failed.put(fj)
                keep.put(m); continue
            }
            val moved = try { src.renameTo(dst) } catch (_: Throwable) { false }
            val ok = moved || try {
                if (src.isDirectory) copyTree(src, dst) else copyFileImpl(src, dst)
                src.deleteRecursively(); true
            } catch (_: Throwable) { false }
            if (!ok) {
                val fj = JSObject(); fj.put("id", id); fj.put("reason", "MOVE_FAILED"); fj.put("originalPath", target); failed.put(fj)
                keep.put(m); continue
            }
            val rj = JSObject(); rj.put("id", id); rj.put("restoredPath", dst.absolutePath); restored.put(rj)
        }
        writeTrashIndex(keep)
        val out = JSObject(); out.put("restored", restored); out.put("failed", failed); call.resolve(out)
    }

    @PluginMethod
    fun permanentDeleteInTrash(call: PluginCall) {
        val ids = call.getArray("ids") ?: return call.reject("BAD_ARGS")
        val deleted = JSArray(); val failed = JSArray()
        val requested = HashSet<String>()
        for (i in 0 until ids.length()) ids.optString(i, null)?.let { requested.add(it) }
        val index = readTrashIndex(); val keep = JSArray()
        for (i in 0 until index.length()) {
            val m = index.optJSONObject(i) ?: continue
            val id = m.optString("id")
            if (!requested.contains(id)) { keep.put(m); continue }
            val f = File(trashDir, id)
            val ok = if (!f.exists()) true else if (f.isDirectory) f.deleteRecursively() else f.delete()
            if (ok) deleted.put(id) else { failed.put(id); keep.put(m) }
        }
        writeTrashIndex(keep)
        val out = JSObject(); out.put("deleted", deleted); out.put("failed", failed); call.resolve(out)
    }

    @PluginMethod
    fun emptyTrash(call: PluginCall) {
        var del = 0; var fail = 0
        val index = readTrashIndex()
        for (i in 0 until index.length()) {
            val m = index.optJSONObject(i) ?: continue
            val f = File(trashDir, m.optString("id"))
            val ok = if (!f.exists()) true else if (f.isDirectory) f.deleteRecursively() else f.delete()
            if (ok) del++ else fail++
        }
        if (fail == 0) writeTrashIndex(JSArray())
        val out = JSObject(); out.put("deleted", del); out.put("failed", fail); call.resolve(out)
    }

    // -------- Sharing --------

    @PluginMethod
    fun shareFiles(call: PluginCall) {
        val paths = call.getArray("paths") ?: return call.reject("BAD_ARGS")
        if (!hasAllFilesAccess()) return call.reject("DENIED", "storage permission required")
        try {
            val authority = context.packageName + ".fileprovider"
            val uris = ArrayList<Uri>()
            for (i in 0 until paths.length()) {
                val p = paths.optString(i, null) ?: continue
                val f = File(p); if (!f.exists() || f.isDirectory) continue
                uris.add(FileProvider.getUriForFile(context, authority, f))
            }
            if (uris.isEmpty()) return call.reject("NOT_FOUND", "no shareable file")
            val intent = if (uris.size == 1) {
                Intent(Intent.ACTION_SEND).apply {
                    type = "*/*"; putExtra(Intent.EXTRA_STREAM, uris[0])
                }
            } else {
                Intent(Intent.ACTION_SEND_MULTIPLE).apply {
                    type = "*/*"; putParcelableArrayListExtra(Intent.EXTRA_STREAM, uris)
                }
            }
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            val chooser = Intent.createChooser(intent, "Partager").apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(chooser)
            call.resolve()
        } catch (e: Throwable) {
            call.reject("IO_FAILED", e.message)
        }
    }

    @PluginMethod
    fun openFile(call: PluginCall) {
        val path = call.getString("path") ?: return call.reject("BAD_ARGS", "path required")
        if (!hasAllFilesAccess()) return call.reject("DENIED", "storage permission required")
        try {
            val f = File(path)
            if (!f.exists() || f.isDirectory) return call.reject("NOT_FOUND", "file not found")
            val authority = context.packageName + ".fileprovider"
            val uri: Uri = FileProvider.getUriForFile(context, authority, f)
            val mime = guessMime(f.name)
            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, mime)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            val chooser = Intent.createChooser(intent, "Ouvrir avec").apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            val target = activity ?: context
            target.startActivity(chooser)
            call.resolve(JSObject().apply { put("opened", true) })
        } catch (e: android.content.ActivityNotFoundException) {
            call.reject("NO_APP", "aucune application ne peut ouvrir ce fichier")
        } catch (e: Throwable) {
            call.reject("IO_FAILED", e.message)
        }
    }

    private fun guessMime(name: String): String {
        val dot = name.lastIndexOf('.')
        val ext = if (dot > 0) name.substring(dot + 1).lowercase() else ""
        val map = android.webkit.MimeTypeMap.getSingleton()
        return map.getMimeTypeFromExtension(ext) ?: "*/*"
    }

    // -------- Paquets Android (APK / AAB / XAPK) --------
    //
    // Un APK est techniquement un ZIP, mais fonctionnellement un paquet
    // installable : ces méthodes déclenchent l'installateur système réel
    // (ACTION_VIEW + content:// via FileProvider), vérifient l'autorisation
    // « installer des applications inconnues » et lisent le manifeste du
    // paquet SANS lire l'intégralité du fichier (getPackageArchiveInfo ne
    // parse que l'entrée AndroidManifest.xml).

    private fun canRequestInstalls(): Boolean =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try { context.packageManager.canRequestPackageInstalls() } catch (_: Throwable) { false }
        } else true

    @PluginMethod
    fun canInstallPackages(call: PluginCall) {
        call.resolve(JSObject().apply { put("allowed", canRequestInstalls()) })
    }

    @PluginMethod
    fun openInstallPermissionSettings(call: PluginCall) {
        val pkgUri = Uri.parse("package:" + context.packageName)
        val candidates = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            listOf(
                "unknown_app_sources_app" to
                    Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES).apply { data = pkgUri },
                "unknown_app_sources" to Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES),
                "app_details" to
                    Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply { data = pkgUri },
            )
        } else {
            listOf(
                "security_settings" to Intent(Settings.ACTION_SECURITY_SETTINGS),
                "app_details" to
                    Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply { data = pkgUri },
            )
        }
        val opened = openFirstAvailableSettings(candidates)
        if (opened == null) call.reject("NO_SETTINGS", "réglage introuvable")
        else call.resolve(JSObject().apply { put("screen", opened) })
    }

    @PluginMethod
    fun packageInfo(call: PluginCall) {
        val path = call.getString("path") ?: return call.reject("BAD_ARGS", "path required")
        if (!hasAllFilesAccess()) return call.reject("DENIED", "storage permission required")
        val f = File(path)
        if (!f.exists() || f.isDirectory) return call.reject("NOT_FOUND", "file not found")
        val res = JSObject().apply {
            put("path", path)
            put("size", f.length())
            put("mtime", f.lastModified())
        }
        try {
            val pm = context.packageManager
            val info: PackageInfo? = pm.getPackageArchiveInfo(path, 0)
            if (info == null) {
                res.put("valid", false)
                return call.resolve(res)
            }
            val appInfo = info.applicationInfo
            if (appInfo != null) {
                appInfo.sourceDir = path
                appInfo.publicSourceDir = path
                try {
                    res.put("label", appInfo.loadLabel(pm).toString())
                } catch (_: Throwable) { /* libellé indisponible */ }
                // Icône réelle du paquet (lue dans l'APK, jamais celle d'une
                // app installée) : indispensable pour afficher un APK reçu
                // comme une application et non comme un fichier anonyme.
                try {
                    val icon = pm.getApplicationIcon(appInfo)
                    val b64 = drawableToBase64(icon, 128)
                    if (b64 != null) res.put("iconBase64", b64)
                } catch (_: Throwable) { /* icône indisponible */ }

                res.put("minSdk", if (Build.VERSION.SDK_INT >= 24) appInfo.minSdkVersion else 0)
                res.put("targetSdk", appInfo.targetSdkVersion)
                res.put(
                    "compatible",
                    Build.VERSION.SDK_INT < 24 || appInfo.minSdkVersion <= Build.VERSION.SDK_INT,
                )
            }
            res.put("valid", true)
            res.put("packageName", info.packageName)
            res.put("versionName", info.versionName ?: "")
            val code = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                info.longVersionCode
            } else {
                @Suppress("DEPRECATION") info.versionCode.toLong()
            }
            res.put("versionCode", code)
            // Le paquet est-il déjà installé ? (comparaison de version)
            try {
                val installed = pm.getPackageInfo(info.packageName, 0)
                res.put("installed", true)
                res.put("installedVersionName", installed.versionName ?: "")
            } catch (_: Throwable) {
                res.put("installed", false)
            }
            call.resolve(res)
        } catch (e: Throwable) {
            res.put("valid", false)
            res.put("error", e.message ?: "parse failed")
            call.resolve(res)
        }
    }

    @PluginMethod
    fun installPackage(call: PluginCall) {
        val path = call.getString("path") ?: return call.reject("BAD_ARGS", "path required")
        if (!hasAllFilesAccess()) return call.reject("DENIED", "storage permission required")
        val f = File(path)
        if (!f.exists() || f.isDirectory) return call.reject("NOT_FOUND", "file not found")
        if (!f.name.lowercase().endsWith(".apk")) {
            return call.reject("NOT_INSTALLABLE", "seuls les fichiers .apk sont installables")
        }
        if (!canRequestInstalls()) return call.reject("NEEDS_PERMISSION", "install permission required")
        try {
            val authority = context.packageName + ".fileprovider"
            val uri: Uri = FileProvider.getUriForFile(context, authority, f)
            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, "application/vnd.android.package-archive")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            val target = activity ?: context
            target.startActivity(intent)
            call.resolve(JSObject().apply { put("started", true) })
        } catch (e: android.content.ActivityNotFoundException) {
            call.reject("NO_INSTALLER", "installateur système indisponible")
        } catch (e: Throwable) {
            call.reject("IO_FAILED", e.message)
        }
    }

    // -------- Base64 I/O --------

    @PluginMethod
    fun readFileBase64(call: PluginCall) {
        val path = call.getString("path") ?: return call.reject("BAD_ARGS")
        if (!hasAllFilesAccess()) return call.reject("DENIED", "storage permission required")
        val f = File(path)
        if (!f.exists() || f.isDirectory) return call.reject("NOT_FOUND")
        try {
            val bytes = f.readBytes()
            val out = JSObject()
            out.put("data", Base64.encodeToString(bytes, Base64.NO_WRAP))
            out.put("size", bytes.size.toLong())
            call.resolve(out)
        } catch (e: Throwable) { call.reject("IO_FAILED", e.message) }
    }

    @PluginMethod
    fun writeFileBase64(call: PluginCall) {
        val path = call.getString("path") ?: return call.reject("BAD_ARGS")
        val data = call.getString("data") ?: return call.reject("BAD_ARGS")
        val overwrite = call.getBoolean("overwrite", false) == true
        if (!hasAllFilesAccess()) return call.reject("DENIED", "storage permission required")
        val f = File(path)
        if (f.exists() && !overwrite) return call.reject("EXISTS")
        f.parentFile?.mkdirs()
        try {
            val bytes = Base64.decode(data, Base64.DEFAULT)
            f.writeBytes(bytes)
            val out = JSObject(); out.put("path", f.absolutePath); out.put("size", bytes.size.toLong()); call.resolve(out)
        } catch (e: Throwable) { call.reject("IO_FAILED", e.message) }
    }

    // -------- Miniatures persistantes (images / vidéos) --------
    //
    // Sans ce pont, `resolveThumbnail()` côté JS renvoyait toujours `null` :
    // le lecteur vidéo n'avait aucune première image à peindre et affichait
    // un grand rectangle noir le temps du décodage. Les JPEG sont mis en
    // cache dans `cacheDir/gf-thumbs`, clés sur chemin+mtime+taille, donc
    // une deuxième ouverture est instantanée.

    private val thumbsDir: File by lazy {
        File(context.cacheDir, "gf-thumbs").apply { mkdirs() }
    }

    private fun thumbKey(f: File, size: Int): String {
        val raw = "${f.absolutePath}|${f.lastModified()}|${f.length()}|$size"
        var h = 1125899906842597L
        for (c in raw) h = 31 * h + c.code
        return java.lang.Long.toHexString(h)
    }

    private fun decodeImageThumb(f: File, size: Int): Bitmap? {
        val bounds = android.graphics.BitmapFactory.Options().apply { inJustDecodeBounds = true }
        android.graphics.BitmapFactory.decodeFile(f.absolutePath, bounds)
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null
        var sample = 1
        while (bounds.outWidth / (sample * 2) >= size && bounds.outHeight / (sample * 2) >= size) {
            sample *= 2
        }
        val opts = android.graphics.BitmapFactory.Options().apply { inSampleSize = sample }
        val bmp = android.graphics.BitmapFactory.decodeFile(f.absolutePath, opts) ?: return null
        // Respecte l'orientation EXIF, sinon les photos portrait sortent couchées.
        return try {
            val exif = android.media.ExifInterface(f.absolutePath)
            val deg = when (
                exif.getAttributeInt(
                    android.media.ExifInterface.TAG_ORIENTATION,
                    android.media.ExifInterface.ORIENTATION_NORMAL
                )
            ) {
                android.media.ExifInterface.ORIENTATION_ROTATE_90 -> 90f
                android.media.ExifInterface.ORIENTATION_ROTATE_180 -> 180f
                android.media.ExifInterface.ORIENTATION_ROTATE_270 -> 270f
                else -> 0f
            }
            if (deg == 0f) bmp
            else {
                val m = android.graphics.Matrix().apply { postRotate(deg) }
                Bitmap.createBitmap(bmp, 0, 0, bmp.width, bmp.height, m, true)
            }
        } catch (_: Throwable) {
            bmp
        }
    }

    private fun decodeVideoThumb(f: File, size: Int): Bitmap? {
        val mmr = android.media.MediaMetadataRetriever()
        return try {
            mmr.setDataSource(f.absolutePath)
            // Image représentative : ~10 % de la durée (la toute première
            // image est souvent noire), plafonnée à 3 s pour rester rapide.
            val durationMs = mmr
                .extractMetadata(android.media.MediaMetadataRetriever.METADATA_KEY_DURATION)
                ?.toLongOrNull() ?: 0L
            val atUs = if (durationMs > 1000L) minOf(durationMs / 10L, 3000L) * 1000L else 0L
            // `getScaledFrameAtTime` évite de décoder une image pleine
            // résolution (beaucoup plus rapide et sans pic mémoire).
            val frame = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
                mmr.getScaledFrameAtTime(
                    atUs,
                    android.media.MediaMetadataRetriever.OPTION_CLOSEST_SYNC,
                    size,
                    size
                )
            } else null
            frame ?: mmr.getFrameAtTime(atUs, android.media.MediaMetadataRetriever.OPTION_CLOSEST_SYNC) ?: mmr.frameAtTime
        } catch (_: Throwable) {
            null
        } finally {
            try { mmr.release() } catch (_: Throwable) { }
        }
    }

    private fun isVideoFile(name: String): Boolean {
        val ext = name.substringAfterLast('.', "").lowercase()
        return ext in setOf(
            "mp4", "mkv", "webm", "3gp", "3g2", "avi", "mov", "m4v", "ts", "m2ts", "mts",
            "flv", "wmv", "asf", "mpg", "mpeg", "ogv", "divx", "f4v", "mxf"
        )
    }

    private fun isImageFile(name: String): Boolean {
        val ext = name.substringAfterLast('.', "").lowercase()
        return ext in setOf(
            "jpg", "jpeg", "jpe", "jfif", "png", "webp", "gif", "bmp", "heic", "heif",
            "avif", "tif", "tiff", "dng", "ico", "cr2", "nef", "arw"
        )
    }

    @PluginMethod
    fun getOrCreateThumbnail(call: PluginCall) {
        val path = call.getString("path") ?: return call.reject("BAD_ARGS")
        val size = (call.getInt("size") ?: 320).coerceIn(64, 1080)
        val f = File(path)
        if (!f.exists() || f.isDirectory) return call.reject("NOT_FOUND")

        val out = File(thumbsDir, "${thumbKey(f, size)}.jpg")
        if (out.exists() && out.length() > 0) {
            val res = JSObject()
            res.put("cachePath", out.absolutePath)
            res.put("cached", true)
            res.put("size", out.length())
            return call.resolve(res)
        }

        try {
            val bmp = when {
                isVideoFile(f.name) -> decodeVideoThumb(f, size)
                isImageFile(f.name) -> decodeImageThumb(f, size)
                // Extension inconnue / absente : on tente les deux décodeurs.
                else -> decodeImageThumb(f, size) ?: decodeVideoThumb(f, size)
            } ?: return call.reject("UNSUPPORTED", "no thumbnail for this file type")

            // Mise à l'échelle finale : la plus grande dimension = `size`.
            val scale = size.toFloat() / maxOf(bmp.width, bmp.height).toFloat()
            val scaled = if (scale < 1f) {
                Bitmap.createScaledBitmap(
                    bmp,
                    maxOf(1, (bmp.width * scale).toInt()),
                    maxOf(1, (bmp.height * scale).toInt()),
                    true
                )
            } else bmp

            FileOutputStream(out).use { fos ->
                scaled.compress(Bitmap.CompressFormat.JPEG, 90, fos)
            }
            if (scaled !== bmp) scaled.recycle()
            bmp.recycle()

            val res = JSObject()
            res.put("cachePath", out.absolutePath)
            res.put("cached", false)
            res.put("size", out.length())
            call.resolve(res)
        } catch (e: Throwable) {
            try { out.delete() } catch (_: Throwable) { }
            call.reject("IO_FAILED", e.message)
        }
    }

    @PluginMethod
    fun clearThumbnailCache(call: PluginCall) {
        var deleted = 0
        var freed = 0L
        try {
            thumbsDir.listFiles()?.forEach {
                val len = it.length()
                if (it.delete()) { deleted++; freed += len }
            }
        } catch (_: Throwable) { }
        val res = JSObject()
        res.put("deleted", deleted)
        res.put("bytesFreed", freed)
        call.resolve(res)
    }

    /**
     * Métadonnées vidéo lues sans démarrer le décodeur : le lecteur connaît
     * le ratio et l'orientation *avant* la première image et peut donc
     * dimensionner la scène immédiatement, sans saut de mise en page.
     */
    @PluginMethod
    fun getVideoInfo(call: PluginCall) {
        val path = call.getString("path") ?: return call.reject("BAD_ARGS")
        val f = File(path)
        if (!f.exists() || f.isDirectory) return call.reject("NOT_FOUND")
        val mmr = android.media.MediaMetadataRetriever()
        try {
            mmr.setDataSource(f.absolutePath)
            fun meta(key: Int) = mmr.extractMetadata(key)?.toLongOrNull() ?: 0L
            val res = JSObject()
            res.put("width", meta(android.media.MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH))
            res.put("height", meta(android.media.MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT))
            res.put("rotation", meta(android.media.MediaMetadataRetriever.METADATA_KEY_VIDEO_ROTATION))
            res.put("durationMs", meta(android.media.MediaMetadataRetriever.METADATA_KEY_DURATION))
            call.resolve(res)
        } catch (e: Throwable) {
            call.reject("IO_FAILED", e.message)
        } finally {
            try { mmr.release() } catch (_: Throwable) { }
        }
    }

    /** Accepte `#rrggbb`, `#rrggbbaa` (usage web) et `#aarrggbb`. */
    private fun parseColor(value: String, fallback: Int): Int {
        val v = value.trim()
        if (v.isEmpty()) return fallback
        return try {
            when (v.length) {
                9 -> {
                    val r = v.substring(1, 3).toInt(16)
                    val g = v.substring(3, 5).toInt(16)
                    val b = v.substring(5, 7).toInt(16)
                    val a = v.substring(7, 9).toInt(16)
                    Color.argb(a, r, g, b)
                }
                else -> Color.parseColor(v)
            }
        } catch (_: Throwable) {
            fallback
        }
    }

    private fun uniqueSibling(file: File): File {
        val name = file.name
        val dot = name.lastIndexOf('.')
        val base = if (dot > 0) name.substring(0, dot) else name
        val ext = if (dot > 0) name.substring(dot) else ""
        var i = 1
        var candidate = File(file.parentFile, "$base ($i)$ext")
        while (candidate.exists() && i < 1000) {
            i++
            candidate = File(file.parentFile, "$base ($i)$ext")
        }
        return candidate
    }

    // -------- Archives (ZIP) --------

    @PluginMethod
    fun archiveInfo(call: PluginCall) {
        val out = JSObject()
        val create = JSArray().apply { put("zip") }
        val read = JSArray().apply { put("zip") }
        out.put("supportedCreate", create)
        out.put("supportedRead", read)
        out.put("passwordSupported", false)
        out.put("splitSupported", false)
        call.resolve(out)
    }

    @PluginMethod
    fun listArchive(call: PluginCall) {
        val path = call.getString("path") ?: return call.reject("BAD_ARGS")
        if (!hasAllFilesAccess()) return call.reject("DENIED", "storage permission required")
        val f = File(path)
        if (!f.exists() || f.isDirectory) return call.reject("NOT_FOUND")
        try {
            ZipFile(f).use { zip ->
                val entries = JSArray(); var files = 0; var dirs = 0; var totalUncompressed = 0L
                val it = zip.entries()
                while (it.hasMoreElements()) {
                    val e = it.nextElement()
                    val ej = JSObject()
                    ej.put("name", e.name); ej.put("isDirectory", e.isDirectory)
                    ej.put("size", e.size); ej.put("compressedSize", e.compressedSize)
                    ej.put("mtime", e.time); ej.put("crc", e.crc)
                    entries.put(ej)
                    if (e.isDirectory) dirs++ else { files++; totalUncompressed += maxOf(e.size, 0) }
                }
                val out = JSObject()
                out.put("path", f.absolutePath); out.put("format", "zip")
                out.put("archiveSize", f.length()); out.put("mtime", f.lastModified())
                out.put("fileCount", files); out.put("dirCount", dirs)
                out.put("totalUncompressed", totalUncompressed); out.put("entries", entries)
                call.resolve(out)
            }
        } catch (e: Throwable) { call.reject("IO_FAILED", e.message) }
    }

    @PluginMethod
    fun createZipArchive(call: PluginCall) {
        val sources = call.getArray("sources") ?: return call.reject("BAD_ARGS")
        val destination = call.getString("destination") ?: return call.reject("BAD_ARGS")
        val overwrite = call.getBoolean("overwrite", false) == true
        if (!hasAllFilesAccess()) return call.reject("DENIED", "storage permission required")
        val dst = File(destination)
        if (dst.exists() && !overwrite) return call.reject("EXISTS")
        dst.parentFile?.mkdirs()
        var files = 0
        try {
            ZipOutputStream(FileOutputStream(dst).buffered()).use { zos ->
                for (i in 0 until sources.length()) {
                    val p = sources.optString(i, null) ?: continue
                    val f = File(p); if (!f.exists()) continue
                    files += zipInto(zos, f, f.name)
                }
            }
            val out = JSObject(); out.put("path", dst.absolutePath); out.put("size", dst.length()); out.put("fileCount", files); call.resolve(out)
        } catch (e: Throwable) { call.reject("IO_FAILED", e.message) }
    }

    @PluginMethod
    fun extractArchive(call: PluginCall) {
        val source = call.getString("source") ?: return call.reject("BAD_ARGS")
        val destination = call.getString("destination") ?: return call.reject("BAD_ARGS")
        val conflict = call.getString("conflict", "rename") ?: "rename"
        if (!hasAllFilesAccess()) return call.reject("DENIED", "storage permission required")
        val src = File(source); val dst = File(destination)
        if (!src.exists()) return call.reject("NOT_FOUND")
        dst.mkdirs()
        var completed = 0; var skipped = 0; var overwritten = 0
        try {
            ZipInputStream(FileInputStream(src).buffered()).use { zis ->
                var e: ZipEntry? = zis.nextEntry
                while (e != null) {
                    val target = File(dst, e.name)
                    if (!target.canonicalPath.startsWith(dst.canonicalPath)) { zis.closeEntry(); e = zis.nextEntry; continue }
                    if (e.isDirectory) {
                        target.mkdirs()
                    } else {
                        target.parentFile?.mkdirs()
                        val out = when {
                            !target.exists() -> target
                            conflict == "skip" -> { skipped++; null }
                            conflict == "replace" -> { overwritten++; target }
                            else -> uniquePath(target).also { /* rename */ }
                        }
                        if (out != null) {
                            FileOutputStream(out).buffered().use { fos -> zis.copyTo(fos) }
                            completed++
                        }
                    }
                    zis.closeEntry(); e = zis.nextEntry
                }
            }
            val out = JSObject()
            out.put("path", dst.absolutePath); out.put("completed", completed)
            out.put("skipped", skipped); out.put("overwritten", overwritten); call.resolve(out)
        } catch (e: Throwable) { call.reject("IO_FAILED", e.message) }
    }

    // -------- Helpers --------

    private fun entryJson(f: File): JSObject {
        val o = JSObject()
        o.put("name", f.name)
        o.put("path", f.absolutePath)
        o.put("isDirectory", f.isDirectory)
        o.put("size", if (f.isDirectory) 0L else f.length())
        o.put("mtime", f.lastModified())
        return o
    }

    private fun copyFileImpl(src: File, dst: File) {
        FileInputStream(src).channel.use { input ->
            FileOutputStream(dst).channel.use { output ->
                var pos = 0L; val size = input.size()
                while (pos < size) pos += input.transferTo(pos, size - pos, output)
            }
        }
    }

    private fun copyTree(src: File, dst: File) {
        if (src.isDirectory) {
            dst.mkdirs()
            src.listFiles()?.forEach { child -> copyTree(child, File(dst, child.name)) }
        } else {
            dst.parentFile?.mkdirs()
            copyFileImpl(src, dst)
        }
    }

    private fun walk(root: File, visit: (File) -> Unit) {
        val stack = ArrayDeque<File>(); stack.addLast(root)
        while (stack.isNotEmpty()) {
            val cur = stack.removeLast()
            visit(cur)
            if (cur.isDirectory) {
                try { cur.listFiles()?.forEach { stack.addLast(it) } } catch (_: Throwable) {}
            }
        }
    }

    private fun folderSize(f: File): Long {
        var total = 0L
        walk(f) { c -> if (!c.isDirectory) total += c.length() }
        return total
    }

    private fun zipInto(zos: ZipOutputStream, f: File, entryName: String): Int {
        if (f.isDirectory) {
            zos.putNextEntry(ZipEntry("$entryName/")); zos.closeEntry()
            var count = 0
            f.listFiles()?.forEach { child -> count += zipInto(zos, child, "$entryName/${child.name}") }
            return count
        }
        zos.putNextEntry(ZipEntry(entryName).apply { time = f.lastModified() })
        FileInputStream(f).buffered().use { it.copyTo(zos) }
        zos.closeEntry()
        return 1
    }

    private fun uniquePath(target: File): File {
        val base = target.nameWithoutExtension; val ext = target.extension
        var i = 1
        while (true) {
            val candidate = File(target.parentFile, if (ext.isEmpty()) "$base ($i)" else "$base ($i).$ext")
            if (!candidate.exists()) return candidate; i++
        }
    }

    private fun readTrashIndex(): JSArray {
        if (!trashIndex.exists()) return JSArray()
        return try { JSArray(trashIndex.readText()) } catch (_: Throwable) { JSArray() }
    }
    private fun writeTrashIndex(arr: JSArray) {
        try { trashIndex.writeText(arr.toString()) } catch (_: Throwable) {}
    }

    // -------- App manager (installed apps, usage access, backups) --------

    @PluginMethod
    fun listInstalledApps(call: PluginCall) {
        val includeIcons = call.getBoolean("includeIcons", true) == true
        val iconSize = call.getInt("iconSize", 96) ?: 96
        val pm = context.packageManager
        val flags = PackageManager.GET_META_DATA
        val apps = try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                pm.getInstalledApplications(PackageManager.ApplicationInfoFlags.of(flags.toLong()))
            } else {
                @Suppress("DEPRECATION") pm.getInstalledApplications(flags)
            }
        } catch (e: Throwable) {
            return call.reject("IO_FAILED", e.message)
        }

        val usageGranted = hasUsageAccess()
        val statsSupported = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
        val storageStats = if (statsSupported)
            context.getSystemService(android.content.Context.STORAGE_STATS_SERVICE) as? StorageStatsManager
        else null
        val defaultUuid = if (statsSupported) StorageManager.UUID_DEFAULT else null
        val usageMap = if (usageGranted) queryLastUsedMap() else emptyMap()

        val out = JSArray()
        for (info in apps) {
            try {
                val pkg = info.packageName
                val pi: PackageInfo? = try {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                        pm.getPackageInfo(pkg, PackageManager.PackageInfoFlags.of(0))
                    } else {
                        @Suppress("DEPRECATION") pm.getPackageInfo(pkg, 0)
                    }
                } catch (_: Throwable) { null }

                val app = JSObject()
                app.put("packageName", pkg)
                app.put("label", (info.loadLabel(pm) ?: pkg).toString())
                app.put("versionName", pi?.versionName ?: "")
                val vCode = when {
                    pi == null -> 0L
                    Build.VERSION.SDK_INT >= Build.VERSION_CODES.P -> pi.longVersionCode
                    else -> @Suppress("DEPRECATION") pi.versionCode.toLong()
                }
                app.put("versionCode", vCode)
                app.put("firstInstallTime", pi?.firstInstallTime ?: 0L)
                app.put("lastUpdateTime", pi?.lastUpdateTime ?: 0L)
                val isSystem = (info.flags and
                    (ApplicationInfo.FLAG_SYSTEM or ApplicationInfo.FLAG_UPDATED_SYSTEM_APP)) != 0
                app.put("isSystem", isSystem)
                app.put("enabled", info.enabled)
                app.put("sourceDir", info.sourceDir ?: "")
                app.put("dataDir", info.dataDir ?: "")
                app.put("targetSdk", info.targetSdkVersion)
                val minSdk = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) info.minSdkVersion else 0
                app.put("minSdk", minSdk)
                val apkSize = try { File(info.sourceDir ?: "").length() } catch (_: Throwable) { 0L }
                app.put("apkSize", apkSize)

                var codeBytes = 0L; var dataBytes = 0L; var cacheBytes = 0L; var totalBytes = 0L
                var statsAvailable = false
                if (statsSupported && usageGranted && storageStats != null && defaultUuid != null) {
                    try {
                        val s = storageStats.queryStatsForPackage(defaultUuid, pkg, Process.myUserHandle())
                        codeBytes = s.appBytes
                        dataBytes = s.dataBytes
                        cacheBytes = s.cacheBytes
                        totalBytes = codeBytes + dataBytes + cacheBytes
                        statsAvailable = true
                    } catch (_: Throwable) {}
                }
                if (!statsAvailable) {
                    codeBytes = apkSize
                    totalBytes = apkSize
                }
                app.put("codeBytes", codeBytes)
                app.put("dataBytes", dataBytes)
                app.put("cacheBytes", cacheBytes)
                app.put("totalBytes", totalBytes)
                app.put("statsAvailable", statsAvailable)

                val lastUsed = usageMap[pkg] ?: 0L
                app.put("lastUsed", lastUsed)
                app.put("usageAvailable", usageGranted)

                if (includeIcons) {
                    try {
                        val icon = pm.getApplicationIcon(info)
                        val b64 = drawableToBase64(icon, iconSize)
                        if (b64 != null) app.put("iconBase64", b64)
                    } catch (_: Throwable) {}
                }
                out.put(app)
            } catch (_: Throwable) {
                // Skip apps we can't introspect (e.g. protected system components).
            }
        }

        val res = JSObject()
        res.put("apps", out)
        res.put("count", out.length())
        res.put("statsSupported", statsSupported)
        res.put("usageAvailable", usageGranted)
        call.resolve(res)
    }

    @PluginMethod
    fun checkUsageAccess(call: PluginCall) {
        val out = JSObject(); out.put("granted", hasUsageAccess()); call.resolve(out)
    }

    @PluginMethod
    fun requestUsageAccess(call: PluginCall) {
        val launcher = activity ?: context
        val candidates = listOf(
            Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).setData(Uri.parse("package:" + context.packageName)),
            Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS),
            Intent(Settings.ACTION_SETTINGS)
        )
        for (intent in candidates) {
            try {
                if (launcher !is Activity) intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                launcher.startActivity(intent)
                return call.resolve()
            } catch (_: Throwable) { /* try next */ }
        }
        call.reject("SETTINGS_UNAVAILABLE", "cannot open usage access settings")
    }

    @PluginMethod
    fun openApp(call: PluginCall) {
        val pkg = call.getString("packageName") ?: return call.reject("BAD_ARGS")
        val intent = context.packageManager.getLaunchIntentForPackage(pkg)
            ?: return call.reject("NO_LAUNCHER", "no launch intent")
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        try { context.startActivity(intent); call.resolve() }
        catch (e: Throwable) { call.reject("IO_FAILED", e.message) }
    }

    @PluginMethod
    fun openAppSettings(call: PluginCall) {
        val pkg = call.getString("packageName") ?: return call.reject("BAD_ARGS")
        try {
            val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:$pkg"))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent); call.resolve()
        } catch (e: Throwable) { call.reject("SETTINGS_UNAVAILABLE", e.message) }
    }

    @PluginMethod
    fun uninstallApp(call: PluginCall) {
        val pkg = call.getString("packageName") ?: return call.reject("BAD_ARGS")
        try {
            val intent = Intent(Intent.ACTION_DELETE, Uri.parse("package:$pkg"))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent); call.resolve()
        } catch (e: Throwable) { call.reject("IO_FAILED", e.message) }
    }

    @PluginMethod
    fun getAppPermissions(call: PluginCall) {
        val pkg = call.getString("packageName") ?: return call.reject("BAD_ARGS")
        val pm = context.packageManager
        try {
            val pi = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU)
                pm.getPackageInfo(pkg, PackageManager.PackageInfoFlags.of(PackageManager.GET_PERMISSIONS.toLong()))
            else
                @Suppress("DEPRECATION") pm.getPackageInfo(pkg, PackageManager.GET_PERMISSIONS)
            val declared = JSArray(); val granted = JSArray()
            val reqs = pi.requestedPermissions
            val flags = pi.requestedPermissionsFlags
            if (reqs != null) {
                for (i in reqs.indices) {
                    declared.put(reqs[i])
                    val isGranted = flags != null && i < flags.size &&
                        (flags[i] and PackageInfo.REQUESTED_PERMISSION_GRANTED) != 0
                    if (isGranted) granted.put(reqs[i])
                }
            }
            val out = JSObject(); out.put("declared", declared); out.put("granted", granted); call.resolve(out)
        } catch (_: Throwable) {
            val out = JSObject(); out.put("declared", JSArray()); out.put("granted", JSArray()); call.resolve(out)
        }
    }

    @PluginMethod
    fun getAppStorage(call: PluginCall) {
        val pkg = call.getString("packageName") ?: return call.reject("BAD_ARGS")
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O || !hasUsageAccess()) {
            val out = JSObject(); out.put("available", false); return call.resolve(out)
        }
        try {
            val ssm = context.getSystemService(android.content.Context.STORAGE_STATS_SERVICE) as StorageStatsManager
            val s = ssm.queryStatsForPackage(StorageManager.UUID_DEFAULT, pkg, Process.myUserHandle())
            val out = JSObject()
            out.put("available", true)
            out.put("codeBytes", s.appBytes)
            out.put("dataBytes", s.dataBytes)
            out.put("cacheBytes", s.cacheBytes)
            out.put("totalBytes", s.appBytes + s.dataBytes + s.cacheBytes)
            call.resolve(out)
        } catch (e: Throwable) {
            val out = JSObject(); out.put("available", false); out.put("error", e.message ?: "error"); call.resolve(out)
        }
    }

    @PluginMethod
    fun backupApk(call: PluginCall) {
        val pkg = call.getString("packageName") ?: return call.reject("BAD_ARGS")
        val destinationDir = call.getString("destinationDir")
        if (!hasAllFilesAccess()) return call.reject("DENIED", "storage permission required")
        try {
            val pm = context.packageManager
            val info = pm.getApplicationInfo(pkg, 0)
            val src = File(info.sourceDir)
            val root = if (destinationDir != null) File(destinationDir)
                else File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), "GeniusFiles/APK")
            root.mkdirs()
            val pi = pm.getPackageInfo(pkg, 0)
            val version = pi.versionName ?: "v" + (
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) pi.longVersionCode
                else @Suppress("DEPRECATION") pi.versionCode.toLong()
            )
            val dst = uniquePath(File(root, "$pkg-$version.apk"))
            copyFileImpl(src, dst)
            val out = JSObject(); out.put("path", dst.absolutePath); out.put("size", dst.length()); call.resolve(out)
        } catch (e: Throwable) { call.reject("IO_FAILED", e.message) }
    }

    @PluginMethod
    fun shareAppInfo(call: PluginCall) {
        val text = call.getString("text") ?: return call.reject("BAD_ARGS")
        try {
            val intent = Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text)
            val chooser = Intent.createChooser(intent, "Partager").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(chooser); call.resolve()
        } catch (e: Throwable) { call.reject("IO_FAILED", e.message) }
    }

    private fun hasUsageAccess(): Boolean {
        return try {
            val ops = context.getSystemService(android.content.Context.APP_OPS_SERVICE) as AppOpsManager
            val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q)
                ops.unsafeCheckOpNoThrow(
                    AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName
                )
            else
                @Suppress("DEPRECATION") ops.checkOpNoThrow(
                    AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName
                )
            mode == AppOpsManager.MODE_ALLOWED
        } catch (_: Throwable) { false }
    }

    private fun queryLastUsedMap(): Map<String, Long> {
        val usm = context.getSystemService(android.content.Context.USAGE_STATS_SERVICE) as? UsageStatsManager
            ?: return emptyMap()
        val end = System.currentTimeMillis()
        val start = end - 365L * 24 * 60 * 60 * 1000
        return try {
            val stats = usm.queryUsageStats(UsageStatsManager.INTERVAL_YEARLY, start, end)
                ?: return emptyMap()
            val map = HashMap<String, Long>()
            for (s in stats) {
                val cur = map[s.packageName] ?: 0L
                if (s.lastTimeUsed > cur) map[s.packageName] = s.lastTimeUsed
            }
            map
        } catch (_: Throwable) { emptyMap() }
    }

    private fun drawableToBase64(d: Drawable, size: Int): String? {
        return try {
            val w = if (size > 0) size else (d.intrinsicWidth.takeIf { it > 0 } ?: 96)
            val h = if (size > 0) size else (d.intrinsicHeight.takeIf { it > 0 } ?: 96)
            val bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
            val canvas = Canvas(bmp)
            d.setBounds(0, 0, w, h)
            d.draw(canvas)
            val baos = ByteArrayOutputStream()
            bmp.compress(Bitmap.CompressFormat.PNG, 100, baos)
            Base64.encodeToString(baos.toByteArray(), Base64.NO_WRAP)
        } catch (_: Throwable) { null }
    }

    // -------- Notifications (Automatisations & alertes) --------

    @PluginMethod
    fun showLocalNotification(call: PluginCall) {
        val id = call.getInt("id") ?: ((System.currentTimeMillis() and 0x7fffffff).toInt())
        val title = call.getString("title") ?: "GeniusFiles"
        val body = call.getString("body") ?: ""
        val route = call.getString("route")
        val channelId = call.getString("channelId") ?: "gf_automations"
        val channelName = call.getString("channelName") ?: "Automatisations"
        val ctx = context
        val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && nm.getNotificationChannel(channelId) == null) {
            val chan = NotificationChannel(channelId, channelName, NotificationManager.IMPORTANCE_DEFAULT)
            chan.description = "Exécutions d'automatisations GeniusFiles"
            nm.createNotificationChannel(chan)
        }
        val launch = ctx.packageManager.getLaunchIntentForPackage(ctx.packageName)?.apply {
            addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            if (!route.isNullOrEmpty()) putExtra("gf_route", route)
        }
        val piFlags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M)
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        else PendingIntent.FLAG_UPDATE_CURRENT
        val pi = launch?.let { PendingIntent.getActivity(ctx, id, it, piFlags) }
        val icon = ctx.applicationInfo.icon.takeIf { it != 0 } ?: android.R.drawable.ic_dialog_info
        val notif = NotificationCompat.Builder(ctx, channelId)
            .setSmallIcon(icon)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setAutoCancel(true)
            .setContentIntent(pi)
            .build()
        try {
            nm.notify(id, notif)
            val res = JSObject()
            res.put("posted", true)
            res.put("id", id)
            call.resolve(res)
        } catch (e: Throwable) {
            call.reject("NOTIFY_FAILED", e.message)
        }
    }

    @PluginMethod
    fun requestNotificationPermission(call: PluginCall) {
        val res = JSObject()
        if (Build.VERSION.SDK_INT >= 33) {
            val perm = "android.permission.POST_NOTIFICATIONS"
            val granted = ContextCompat.checkSelfPermission(context, perm) == PackageManager.PERMISSION_GRANTED
            if (!granted) {
                try { activity?.requestPermissions(arrayOf(perm), 4321) } catch (_: Throwable) {}
            }
            res.put("granted", granted)
        } else {
            res.put("granted", true)
        }
        call.resolve(res)
    }

    @PluginMethod
    fun checkNotificationPermission(call: PluginCall) {
        val res = JSObject()
        val granted = if (Build.VERSION.SDK_INT >= 33) {
            ContextCompat.checkSelfPermission(
                context, "android.permission.POST_NOTIFICATIONS",
            ) == PackageManager.PERMISSION_GRANTED
        } else true
        res.put("granted", granted)
        call.resolve(res)
    }

    // -------- Copie / déplacement natifs (service au premier plan) --------

    private var fileOpsSinkWired = false

    private fun ensureFileOpsSink() {
        if (fileOpsSinkWired) return
        fileOpsSinkWired = true
        FileOpsService.listener = { event, payload ->
            try { notifyListeners(event, payload, true) } catch (_: Throwable) {}
        }
    }

    /**
     * Démarre une copie ou un déplacement entièrement natif. Renvoie
     * immédiatement : la tâche vit dans le service, jamais dans la WebView.
     */
    @PluginMethod
    fun fileOpStart(call: PluginCall) {
        ensureFileOpsSink()
        val mode = call.getString("mode") ?: "copy"
        val destination = call.getString("destination")
            ?: return call.reject("INVALID", "destination requise")
        val arr = call.getArray("sources")
            ?: return call.reject("INVALID", "sources requises")
        val sources = ArrayList<String>()
        for (i in 0 until arr.length()) {
            (arr.opt(i) as? String)?.let { sources.add(it) }
        }
        if (sources.isEmpty()) return call.reject("INVALID", "aucune source")
        val id = call.getString("id") ?: UUID.randomUUID().toString()
        val title = call.getString("title")
            ?: if (sources.size == 1) File(sources[0]).name else "${sources.size} éléments"
        val task = FileOpsService.start(context, id, mode, sources, destination, title)
        call.resolve(task.toJson())
    }

    @PluginMethod
    fun fileOpCancel(call: PluginCall) {
        val id = call.getString("id") ?: return call.reject("INVALID", "id requis")
        FileOpsService.cancel(id)
        call.resolve()
    }

    /** Reprise d'état après un retour dans l'app (ou un redémarrage). */
    @PluginMethod
    fun fileOpList(call: PluginCall) {
        ensureFileOpsSink()
        val res = JSObject()
        res.put("tasks", FileOpsService.snapshot())
        call.resolve(res)
    }

    /** Chemin demandé via l'action « Ouvrir le dossier » d'une notification. */
    @PluginMethod
    fun consumePendingOpenPath(call: PluginCall) {
        val prefs = context.getSharedPreferences(
            FileOpsActionReceiver.PREFS, Context.MODE_PRIVATE,
        )
        val path = prefs.getString(FileOpsActionReceiver.KEY_PENDING_PATH, null)
        if (path != null) prefs.edit().remove(FileOpsActionReceiver.KEY_PENDING_PATH).apply()
        val res = JSObject()
        res.put("path", path ?: "")
        call.resolve(res)
    }

    // -------- Media session (audio player) --------

    private var mediaSinkWired = false

    private fun ensureMediaActionSink() {
        if (mediaSinkWired) return
        mediaSinkWired = true
        AudioPlaybackService.actionSink = { action ->
            try {
                val payload = JSObject()
                payload.put("action", action)
                notifyListeners("mediaAction", payload, true)
            } catch (_: Throwable) { /* ignore */ }
        }
    }

    @PluginMethod
    fun mediaSessionStart(call: PluginCall) {
        ensureMediaActionSink()
        try {
            AudioPlaybackService.start(context) {
                putExtra(AudioPlaybackService.EXTRA_TITLE, call.getString("title") ?: "GeniusFiles")
                putExtra(AudioPlaybackService.EXTRA_ARTIST, call.getString("artist") ?: "")
                putExtra(AudioPlaybackService.EXTRA_PLAYING, call.getBoolean("playing") ?: true)
                call.getString("artworkBase64")?.let {
                    putExtra(AudioPlaybackService.EXTRA_ARTWORK_B64, it)
                }
            }
            call.resolve()
        } catch (e: Throwable) {
            call.reject("MEDIA_START_FAILED", e.message)
        }
    }

    @PluginMethod
    fun mediaSessionUpdate(call: PluginCall) {
        ensureMediaActionSink()
        try {
            AudioPlaybackService.start(context) {
                if (call.hasOption("title")) {
                    putExtra(AudioPlaybackService.EXTRA_TITLE, call.getString("title"))
                }
                if (call.hasOption("artist")) {
                    putExtra(AudioPlaybackService.EXTRA_ARTIST, call.getString("artist"))
                }
                if (call.hasOption("playing")) {
                    putExtra(AudioPlaybackService.EXTRA_PLAYING, call.getBoolean("playing") ?: true)
                }
                if (call.hasOption("artworkBase64")) {
                    putExtra(AudioPlaybackService.EXTRA_ARTWORK_B64, call.getString("artworkBase64"))
                }
            }
            call.resolve()
        } catch (e: Throwable) {
            call.reject("MEDIA_UPDATE_FAILED", e.message)
        }
    }

    @PluginMethod
    fun mediaSessionStop(call: PluginCall) {
        try {
            AudioPlaybackService.stop(context)
            call.resolve()
        } catch (e: Throwable) {
            call.reject("MEDIA_STOP_FAILED", e.message)
        }
    }

    override fun handleOnNewIntent(intent: Intent) {
        super.handleOnNewIntent(intent)
        try {
            if (intent.getBooleanExtra("gf_open_audio", false)) {
                notifyListeners("mediaOpenRequested", JSObject(), true)
            }
        } catch (_: Throwable) { /* ignore */ }
    }

    // -------- Automation alarms (fire even when the app is closed) --------

    @PluginMethod
    fun scheduleAutomationAlarm(call: PluginCall) {
        val id = call.getString("id")
        val atMs = call.getLong("atMs")
        if (id.isNullOrBlank() || atMs == null) {
            call.reject("INVALID_PARAMS", "id and atMs are required")
            return
        }
        val payload = org.json.JSONObject().apply {
            put("id", id)
            put("atMs", atMs)
            put("title", call.getString("title") ?: "Automatisation")
            put("body", call.getString("body") ?: "Exécution planifiée")
            put("route", call.getString("route") ?: "/automatisations")
            put("repeat", call.getString("repeat") ?: "once")
            put("hour", call.getInt("hour") ?: 9)
            put("minute", call.getInt("minute") ?: 0)
            put("daysMask", call.getInt("daysMask") ?: 0)
        }
        AutomationAlarmScheduler.schedule(context, payload)
        val res = JSObject()
        res.put("scheduled", true)
        res.put("atMs", atMs)
        res.put("notifId", AutomationAlarmScheduler.stableNotifId(id))
        call.resolve(res)
    }

    @PluginMethod
    fun cancelAutomationAlarm(call: PluginCall) {
        val id = call.getString("id")
        if (id.isNullOrBlank()) {
            call.reject("INVALID_PARAMS", "id is required")
            return
        }
        AutomationAlarmScheduler.cancel(context, id)
        val res = JSObject()
        res.put("cancelled", true)
        call.resolve(res)
    }

    @PluginMethod
    fun cancelAllAutomationAlarms(call: PluginCall) {
        AutomationAlarmScheduler.cancelAll(context)
        val res = JSObject()
        res.put("cancelled", true)
        call.resolve(res)
    }

    @PluginMethod
    fun listAutomationAlarms(call: PluginCall) {
        val out = JSArray()
        for ((_, raw) in AutomationAlarmScheduler.prefs(context).all) {
            try {
                out.put(JSObject(raw as String))
            } catch (_: Throwable) { /* skip */ }
        }
        val res = JSObject()
        res.put("alarms", out)
        call.resolve(res)
    }

    // ---------------------------------------------------------------------
    // Lecteur vidéo : orientation de l'activité, volume média, luminosité
    // ---------------------------------------------------------------------

    /**
     * Fait pivoter *toute* l'activité (et donc toute l'interface du lecteur),
     * au lieu de tourner uniquement la surface vidéo en CSS.
     */
    @PluginMethod
    fun setOrientation(call: PluginCall) {
        val mode = call.getString("mode") ?: "auto"
        val act: Activity? = activity
        if (act == null) {
            call.reject("no activity")
            return
        }
        act.runOnUiThread {
            act.requestedOrientation = when (mode) {
                "landscape" -> ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
                "portrait" -> ActivityInfo.SCREEN_ORIENTATION_SENSOR_PORTRAIT
                else -> ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
            }
        }
        val res = JSObject()
        res.put("mode", mode)
        call.resolve(res)
    }

    @PluginMethod
    fun getOrientation(call: PluginCall) {
        val cfg = context.resources.configuration
        val landscape = cfg.orientation == Configuration.ORIENTATION_LANDSCAPE
        val res = JSObject()
        res.put("mode", if (landscape) "landscape" else "portrait")
        res.put("landscape", landscape)
        call.resolve(res)
    }

    private fun audioManager(): AudioManager =
        context.getSystemService(Context.AUDIO_SERVICE) as AudioManager

    @PluginMethod
    fun getMediaVolume(call: PluginCall) {
        val am = audioManager()
        val max = am.getStreamMaxVolume(AudioManager.STREAM_MUSIC).coerceAtLeast(1)
        val index = am.getStreamVolume(AudioManager.STREAM_MUSIC)
        val res = JSObject()
        res.put("value", index.toDouble() / max.toDouble())
        res.put("index", index)
        res.put("max", max)
        call.resolve(res)
    }

    /** Agit sur STREAM_MUSIC : les boutons physiques restent synchronisés. */
    @PluginMethod
    fun setMediaVolume(call: PluginCall) {
        val value = (call.getDouble("value") ?: return call.reject("value required"))
            .coerceIn(0.0, 1.0)
        val am = audioManager()
        val max = am.getStreamMaxVolume(AudioManager.STREAM_MUSIC).coerceAtLeast(1)
        val index = Math.round(value * max).toInt().coerceIn(0, max)
        try {
            am.setStreamVolume(AudioManager.STREAM_MUSIC, index, 0)
        } catch (t: Throwable) {
            call.reject(t.message ?: "volume error")
            return
        }
        val res = JSObject()
        res.put("value", index.toDouble() / max.toDouble())
        call.resolve(res)
    }

    @PluginMethod
    fun getWindowBrightness(call: PluginCall) {
        val act = activity
        val res = JSObject()
        val current = act?.window?.attributes?.screenBrightness ?: -1f
        res.put("value", current.toDouble())
        call.resolve(res)
    }

    /** `value < 0` rend la luminosité au réglage système. */
    @PluginMethod
    fun setWindowBrightness(call: PluginCall) {
        val value = (call.getDouble("value") ?: return call.reject("value required")).toFloat()
        val act: Activity? = activity
        if (act == null) {
            call.reject("no activity")
            return
        }
        act.runOnUiThread {
            val win = act.window
            val lp = win.attributes
            lp.screenBrightness = if (value < 0f) {
                WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_NONE
            } else {
                value.coerceIn(0.01f, 1f)
            }
            win.attributes = lp
        }
        val res = JSObject()
        res.put("value", value.toDouble())
        call.resolve(res)
    }
}
