package app.geniusfiles.mobile

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Moteur natif de copie / déplacement.
 *
 * Toute l'opération (planification, streaming NIO, suppression de la
 * source pour un déplacement) s'exécute en Kotlin, dans un service au
 * premier plan. Conséquences :
 *
 *  - la WebView n'est jamais sollicitée : aucun blocage du thread UI ;
 *  - la tâche survit au passage en arrière-plan ET à la fermeture de
 *    l'application (le service est `stopWithTask="false"`) ;
 *  - plusieurs tâches tournent en parallèle sur un pool borné, sans se
 *    bloquer mutuellement et sans saturer le stockage ;
 *  - la mémoire reste plate (transferTo par blocs, aucun buffer géant).
 *
 * L'interface JavaScript se contente de démarrer / annuler / lister les
 * tâches et d'écouter les évènements `fileOpProgress` / `fileOpDone`.
 */
class FileOpsService : Service() {

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        ensureChannel(this)
        val notif = buildSummaryNotification(this)
        try {
            if (Build.VERSION.SDK_INT >= 34) {
                startForeground(NOTIF_SUMMARY, notif, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
            } else {
                startForeground(NOTIF_SUMMARY, notif)
            }
        } catch (_: Throwable) {
        }
        if (intent?.action == ACTION_STOP || tasks.values.none { it.status == "running" }) {
            if (intent?.action == ACTION_STOP) {
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf(startId)
                return START_NOT_STICKY
            }
        }
        return START_STICKY
    }

    /* ------------------------------------------------------------------ */

    class Task(
        val id: String,
        val mode: String,
        val sources: List<String>,
        val destination: String,
        val title: String,
    ) {
        @Volatile var total: Int = 0
        @Volatile var completed: Int = 0
        @Volatile var totalBytes: Long = 0
        @Volatile var bytes: Long = 0
        @Volatile var currentName: String = ""
        @Volatile var status: String = "running"
        @Volatile var speedBps: Long = 0
        @Volatile var etaMs: Long = -1
        val startedAt: Long = System.currentTimeMillis()
        @Volatile var endedAt: Long = 0
        val failures = java.util.Collections.synchronizedList(ArrayList<Pair<String, String>>())
        val cancelled = AtomicBoolean(false)
        val notifId: Int = NOTIF_BASE + (nextNotif++ % 100)

        fun toJson(): JSObject {
            val o = JSObject()
            o.put("id", id)
            o.put("mode", mode)
            o.put("status", status)
            o.put("title", title)
            o.put("destination", destination)
            o.put("source", sources.firstOrNull()?.let { File(it).parent } ?: "")
            o.put("total", total)
            o.put("completed", completed)
            o.put("totalBytes", totalBytes)
            o.put("bytes", bytes)
            o.put("speedBps", speedBps)
            o.put("etaMs", etaMs)
            o.put("currentName", currentName)
            o.put("startedAt", startedAt)
            o.put("endedAt", endedAt)
            val arr = JSArray()
            synchronized(failures) {
                for ((name, reason) in failures) {
                    val f = JSObject(); f.put("name", name); f.put("reason", reason); arr.put(f)
                }
            }
            o.put("failures", arr)
            return o
        }
    }

    companion object {
        const val ACTION_STOP = "app.geniusfiles.mobile.FILEOPS_STOP"
        private const val CHANNEL_ID = "gf_file_ops"
        private const val NOTIF_SUMMARY = 4200
        private const val NOTIF_BASE = 4300
        private var nextNotif = 0

        private val pool = Executors.newFixedThreadPool(2) { r ->
            Thread(r, "gf-fileops").apply { priority = Thread.NORM_PRIORITY - 1 }
        }
        val tasks = ConcurrentHashMap<String, Task>()

        /** Pont vers la WebView : nul lorsque l'application est fermée. */
        @Volatile var listener: ((String, JSObject) -> Unit)? = null

        fun snapshot(): JSArray {
            val arr = JSArray()
            for (t in tasks.values.sortedBy { it.startedAt }) arr.put(t.toJson())
            return arr
        }

        fun cancel(id: String) {
            tasks[id]?.cancelled?.set(true)
        }

        fun start(
            ctx: Context,
            id: String,
            mode: String,
            sources: List<String>,
            destination: String,
            title: String,
        ): Task {
            val task = Task(id, mode, sources, destination, title)
            tasks[id] = task
            ensureChannel(ctx)
            val app = ctx.applicationContext
            try {
                val i = Intent(app, FileOpsService::class.java)
                if (Build.VERSION.SDK_INT >= 26) app.startForegroundService(i) else app.startService(i)
            } catch (_: Throwable) {
            }
            pool.execute { runTask(app, task) }
            return task
        }

        /* ---------------- exécution ---------------- */

        private class Plan(
            val root: File,
            val files: MutableList<File> = ArrayList(),
            val dirs: MutableList<File> = ArrayList(),
            var bytes: Long = 0,
        )

        private fun plan(root: File): Plan {
            val p = Plan(root)
            if (!root.isDirectory) {
                p.files.add(root)
                p.bytes = root.length()
                return p
            }
            val stack = ArrayDeque<File>()
            stack.addLast(root)
            while (stack.isNotEmpty()) {
                val cur = stack.removeLast()
                if (cur.isDirectory) {
                    p.dirs.add(cur)
                    cur.listFiles()?.forEach { stack.addLast(it) }
                } else {
                    p.files.add(cur)
                    p.bytes += cur.length()
                }
            }
            return p
        }

        private fun copyStream(src: File, dst: File) {
            dst.parentFile?.mkdirs()
            FileInputStream(src).channel.use { input ->
                FileOutputStream(dst).channel.use { output ->
                    var pos = 0L
                    val size = input.size()
                    // Blocs de 8 Mio : débit maximal, empreinte mémoire plate.
                    while (pos < size) {
                        val n = input.transferTo(pos, minOf(8L * 1024 * 1024, size - pos), output)
                        if (n <= 0) break
                        pos += n
                    }
                }
            }
            try { dst.setLastModified(src.lastModified()) } catch (_: Throwable) {}
        }

        private fun runTask(ctx: Context, task: Task) {
            val dstRoot = File(task.destination)
            dstRoot.mkdirs()
            val plans = ArrayList<Plan>()
            for (s in task.sources) {
                if (task.cancelled.get()) break
                val f = File(s)
                if (!f.exists()) {
                    task.failures.add(f.name to "Introuvable")
                    continue
                }
                val p = plan(f)
                plans.add(p)
                task.total += p.files.size + p.dirs.size
                task.totalBytes += p.bytes
            }
            emit(ctx, task, force = true)

            var lastTick = System.currentTimeMillis()
            var lastBytes = 0L

            for (p in plans) {
                if (task.cancelled.get()) break
                val srcRoot = p.root
                val target = File(dstRoot, srcRoot.name)

                // Déplacement sur le même volume : rename instantané.
                if (task.mode == "move" && !target.exists() && srcRoot.renameTo(target)) {
                    task.completed += p.files.size + p.dirs.size
                    task.bytes += p.bytes
                    task.currentName = srcRoot.name
                    emit(ctx, task)
                    continue
                }

                val basePath = srcRoot.absolutePath
                for (d in p.dirs) {
                    if (task.cancelled.get()) break
                    val rel = d.absolutePath.removePrefix(basePath).trimStart('/')
                    File(target, rel).mkdirs()
                    task.completed++
                }
                for (f in p.files) {
                    if (task.cancelled.get()) break
                    val rel = f.absolutePath.removePrefix(basePath).trimStart('/')
                    val out = if (rel.isEmpty()) target else File(target, rel)
                    task.currentName = f.name
                    try {
                        if (out.exists()) {
                            task.failures.add(f.name to "Existe déjà à destination")
                        } else {
                            copyStream(f, out)
                            task.bytes += f.length()
                        }
                    } catch (e: Throwable) {
                        // Un échec n'interrompt jamais la tâche : on continue.
                        task.failures.add(f.name to (e.message ?: "Copie impossible"))
                    }
                    task.completed++

                    val now = System.currentTimeMillis()
                    if (now - lastTick >= 400) {
                        val inst = ((task.bytes - lastBytes) * 1000.0 / (now - lastTick)).toLong()
                        task.speedBps =
                            if (task.speedBps > 0) (task.speedBps * 7 + inst * 3) / 10 else inst
                        lastTick = now
                        lastBytes = task.bytes
                        task.etaMs =
                            if (task.speedBps > 0 && task.totalBytes > task.bytes)
                                (task.totalBytes - task.bytes) * 1000 / task.speedBps
                            else -1
                        emit(ctx, task)
                    }
                }
                if (task.mode == "move" && !task.cancelled.get() && task.failures.isEmpty()) {
                    try { srcRoot.deleteRecursively() } catch (_: Throwable) {}
                }
                emit(ctx, task)
            }

            task.status = when {
                task.cancelled.get() -> "cancelled"
                task.failures.isNotEmpty() -> "failed"
                else -> "done"
            }
            task.endedAt = System.currentTimeMillis()
            task.speedBps = 0
            task.etaMs = 0
            emit(ctx, task, force = true)
            listener?.invoke("fileOpDone", task.toJson())
            postFinalNotification(ctx, task)

            // Purge différée : la WebView peut encore lire l'état au retour.
            if (tasks.values.none { it.status == "running" }) {
                try {
                    val i = Intent(ctx, FileOpsService::class.java).setAction(ACTION_STOP)
                    ctx.startService(i)
                } catch (_: Throwable) {}
            }
        }

        private var lastEmit = 0L

        private fun emit(ctx: Context, task: Task, force: Boolean = false) {
            val now = System.currentTimeMillis()
            if (!force && now - lastEmit < 250) return
            lastEmit = now
            listener?.invoke("fileOpProgress", task.toJson())
            updateNotification(ctx, task)
        }

        /* ---------------- notifications ---------------- */

        fun ensureChannel(ctx: Context) {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
            val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            if (nm.getNotificationChannel(CHANNEL_ID) == null) {
                val ch = NotificationChannel(
                    CHANNEL_ID,
                    "Copies et déplacements",
                    NotificationManager.IMPORTANCE_LOW,
                )
                ch.setShowBadge(false)
                nm.createNotificationChannel(ch)
            }
        }

        private fun contentIntent(ctx: Context): PendingIntent? = try {
            val i = ctx.packageManager.getLaunchIntentForPackage(ctx.packageName)
            PendingIntent.getActivity(
                ctx, 0, i,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
        } catch (_: Throwable) { null }

        private fun humanBytes(n: Long): String {
            if (n <= 0) return "0 o"
            val units = arrayOf("o", "Ko", "Mo", "Go", "To")
            var v = n.toDouble(); var i = 0
            while (v >= 1024 && i < units.size - 1) { v /= 1024; i++ }
            return if (v >= 10 || i == 0) "${v.toInt()} ${units[i]}" else String.format("%.1f %s", v, units[i])
        }

        private fun humanDelay(ms: Long): String? {
            if (ms <= 0) return null
            val s = (ms / 1000).toInt()
            if (s < 60) return "$s s"
            val m = s / 60
            return if (m < 60) "$m min" else "${m / 60} h ${m % 60} min"
        }

        fun buildSummaryNotification(ctx: Context): Notification =
            NotificationCompat.Builder(ctx, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.stat_sys_download)
                .setContentTitle("GeniusFiles")
                .setContentText("Transferts de fichiers en cours")
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setContentIntent(contentIntent(ctx))
                .build()

        private fun updateNotification(ctx: Context, task: Task) {
            val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            val pct = when {
                task.totalBytes > 0 -> ((task.bytes * 100) / task.totalBytes).toInt()
                task.total > 0 -> (task.completed * 100) / task.total
                else -> 0
            }
            val bits = ArrayList<String>()
            if (task.total > 0) bits.add("${task.completed}/${task.total}")
            if (task.totalBytes > 0) bits.add("${humanBytes(task.bytes)} / ${humanBytes(task.totalBytes)}")
            if (task.speedBps > 0) bits.add("${humanBytes(task.speedBps)}/s")
            humanDelay(task.etaMs)?.let { bits.add("reste $it") }

            val cancelIntent = Intent(ctx, FileOpsActionReceiver::class.java)
                .setAction(FileOpsActionReceiver.ACTION_CANCEL)
                .putExtra("id", task.id)
            val cancelPi = PendingIntent.getBroadcast(
                ctx, task.notifId, cancelIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )

            val n = NotificationCompat.Builder(ctx, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.stat_sys_download)
                .setContentTitle(
                    (if (task.mode == "copy") "Copie" else "Déplacement") + " — ${task.title}"
                )
                .setContentText(bits.joinToString(" · "))
                .setSubText(task.currentName)
                .setStyle(NotificationCompat.BigTextStyle().bigText(
                    bits.joinToString(" · ") + "\n" + task.currentName
                ))
                .setProgress(100, pct.coerceIn(0, 100), task.totalBytes <= 0 && task.total <= 0)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setContentIntent(contentIntent(ctx))
                .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Annuler", cancelPi)
                .build()
            try { nm.notify(task.notifId, n) } catch (_: Throwable) {}
        }

        private fun postFinalNotification(ctx: Context, task: Task) {
            val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            val title = when {
                task.status == "cancelled" ->
                    if (task.mode == "copy") "Copie annulée" else "Déplacement annulé"
                task.status == "failed" ->
                    if (task.mode == "copy") "Copie incomplète" else "Déplacement incomplet"
                else -> if (task.mode == "copy") "Copie terminée" else "Déplacement terminé"
            }
            val secs = ((task.endedAt - task.startedAt) / 1000).coerceAtLeast(1)
            val body = buildString {
                append("${task.completed} élément(s) · ${humanBytes(task.bytes)}")
                if (task.failures.isNotEmpty()) append(" · ${task.failures.size} échec(s)")
                append(" · ${humanDelay(secs * 1000) ?: "$secs s"}")
                append("\n→ ${File(task.destination).name.ifEmpty { task.destination }}")
            }
            val open = Intent(ctx, FileOpsActionReceiver::class.java)
                .setAction(FileOpsActionReceiver.ACTION_OPEN_DEST)
                .putExtra("path", task.destination)
            val openPi = PendingIntent.getBroadcast(
                ctx, task.notifId + 1000, open,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
            val n = NotificationCompat.Builder(ctx, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.stat_sys_download_done)
                .setContentTitle(title)
                .setContentText(body.replace("\n", " "))
                .setStyle(NotificationCompat.BigTextStyle().bigText(body))
                .setAutoCancel(true)
                .setContentIntent(contentIntent(ctx))
                .addAction(android.R.drawable.ic_menu_view, "Ouvrir le dossier", openPi)
                .build()
            try {
                nm.cancel(task.notifId)
                nm.notify(task.notifId + 500, n)
            } catch (_: Throwable) {}
        }
    }
}
