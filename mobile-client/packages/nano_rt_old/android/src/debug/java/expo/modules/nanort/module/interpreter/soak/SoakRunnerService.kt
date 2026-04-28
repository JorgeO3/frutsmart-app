package expo.modules.nanort.module.interpreter.soak

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import expo.modules.nanort.core.AppAssets
import expo.modules.nanort.module.interpreter.ModelId
import expo.modules.nanort.module.interpreter.ModelManager
import expo.modules.nanort.module.interpreter.internal.InferenceFlags
import expo.modules.nanort.module.interpreter.internal.InterpreterActor
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.atomic.AtomicBoolean
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeout
import org.json.JSONArray
import org.json.JSONObject

class SoakRunnerService : Service() {
  private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
  private val running = AtomicBoolean(false)
  private val stopRequested = AtomicBoolean(false)

  private var sessionId: String = ""
  private var config: SoakConfig = SoakConfig(
    profile = SoakControl.PROFILE_MIXED,
    durationMinutes = 0,
    gpuEnabled = false,
    failFast = true,
    maxThreadDelta = 1,
    maxChildJobDelta = 4,
    queueWaitP99Ms = 5_000.0,
    holdP99Ms = 5_000.0,
    maxPendingReplies = 128,
  )

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      SoakControl.ACTION_STOP -> {
        stopRequested.set(true)
        return START_NOT_STICKY
      }

      SoakControl.ACTION_START -> {
        if (running.get()) return START_STICKY

        AppAssets.init(applicationContext)

        config = SoakControl.configFromIntent(intent)
        sessionId = buildSessionId()
        stopRequested.set(false)
        running.set(true)

        startForeground(NOTIFICATION_ID, notification("NanoRT soak running: ${config.profile}"))
        serviceScope.launch {
          runSoakLoop()
        }
        return START_STICKY
      }

      else -> return START_NOT_STICKY
    }
  }

  private suspend fun runSoakLoop() {
    val t0 = System.currentTimeMillis()
    val durationMs = if (config.indefinite) null else config.durationMinutes * 60_000L
    val store = SoakStore(this, sessionId)

    InferenceFlags.gpuEnabled = config.gpuEnabled

    val baselineThreads = nanoRtThreadCount()
    val baselineChildJobs = ModelManager.actorDebugSnapshotForSoak().childJobCount
    var iterations = 0L
    var errors = 0L
    val events = ArrayDeque<String>()

    fun pushEvent(message: String) {
      if (events.size >= 50) events.removeFirst()
      events.addLast(message)
    }

    suspend fun writeStatus(state: String, reason: String? = null) {
      val snapshot = ModelManager.actorDebugSnapshotForSoak()
      val json = JSONObject()
        .put("sessionId", sessionId)
        .put("state", state)
        .put("reason", reason ?: JSONObject.NULL)
        .put("profile", config.profile)
        .put("durationMinutes", config.durationMinutes)
        .put("elapsedMs", System.currentTimeMillis() - t0)
        .put("iterations", iterations)
        .put("errors", errors)
        .put("baselineNanoRtThreads", baselineThreads)
        .put("baselineChildJobs", baselineChildJobs)
        .put("currentNanoRtThreads", nanoRtThreadCount())
        .put("actor", snapshot.toJson())
        .put("events", JSONArray(events.toList()))
      store.writeStatus(json)
    }

    try {
      writeStatus("running")

      while (
        serviceScope.isActive &&
        !stopRequested.get() &&
        (durationMs == null || System.currentTimeMillis() - t0 < durationMs)
      ) {
        iterations += 1
        val model = pickModel(config.profile, iterations)

        val op = when {
          config.profile == SoakControl.PROFILE_SHUTDOWN && iterations % 10L == 0L -> "shutdown"
          config.profile == SoakControl.PROFILE_WORKFLOW_CLASSIFICATION && iterations % 25L == 0L -> "release"
          config.profile == SoakControl.PROFILE_WORKFLOW_SEGMENTATION && iterations % 20L == 0L -> "release"
          iterations % 40L == 0L -> "shutdown"
          iterations % 15L == 0L -> "release"
          else -> "run"
        }

        try {
          when (op) {
            "run" -> withTimeout(10_000L) {
              ModelManager.withInterpreter(model) { session ->
                val input = session.getInputBuffer()
                if (input.capacity() >= 4) input.putFloat(0, iterations.toFloat())
                session.runInference()
                if (iterations % 11L == 0L) delay(2)
              }
            }

            "release" -> withTimeout(5_000L) { ModelManager.releaseCurrentSession() }
            "shutdown" -> withTimeout(8_000L) { ModelManager.shutdown() }
          }
        } catch (t: Throwable) {
          errors += 1
          pushEvent("iteration=$iterations op=$op model=${model.name} error=${t::class.java.simpleName}:${t.message}")
          if (config.failFast) {
            writeStatus("failed", "operation_failed")
            writeFinalReport(store, t, t0, iterations, errors, baselineThreads, baselineChildJobs, events)
            stopSelf()
            running.set(false)
            return
          }
        }

        val snapshot = ModelManager.actorDebugSnapshotForSoak()
        val threadDelta = nanoRtThreadCount() - baselineThreads
        val childJobDelta = snapshot.childJobCount - baselineChildJobs

        val breach = thresholdBreach(snapshot, threadDelta, childJobDelta)
        if (breach != null) {
          pushEvent("threshold_breach $breach")
          writeStatus("failed", breach)
          writeFinalReport(
            store = store,
            error = IllegalStateException(breach),
            startMs = t0,
            iterations = iterations,
            errors = errors,
            baselineThreads = baselineThreads,
            baselineChildJobs = baselineChildJobs,
            events = events,
          )
          stopSelf()
          running.set(false)
          return
        }

        if (iterations % 20L == 0L) {
          pushEvent("iteration=$iterations model=${model.name} op=$op")
          writeStatus("running")
        }
      }

      val reason = if (stopRequested.get()) "manual_stop" else "duration_reached"
      writeStatus("stopping", reason)
      writeFinalReport(store, null, t0, iterations, errors, baselineThreads, baselineChildJobs, events)
      writeStatus("completed", reason)
    } finally {
      runCatching { ModelManager.shutdown() }
      running.set(false)
      stopForeground(STOP_FOREGROUND_REMOVE)
      stopSelf()
    }
  }

  private suspend fun writeFinalReport(
    store: SoakStore,
    error: Throwable?,
    startMs: Long,
    iterations: Long,
    errors: Long,
    baselineThreads: Int,
    baselineChildJobs: Int,
    events: ArrayDeque<String>,
  ) {
    val snapshot = ModelManager.actorDebugSnapshotForSoak()
    val report = JSONObject()
      .put("sessionId", sessionId)
      .put("status", if (error == null) "PASS" else "FAIL")
      .put("reason", if (error == null) "completed" else "fail_fast")
      .put("elapsedMs", System.currentTimeMillis() - startMs)
      .put("profile", config.profile)
      .put("durationMinutes", config.durationMinutes)
      .put("iterations", iterations)
      .put("errors", errors)
      .put("baselineNanoRtThreads", baselineThreads)
      .put("baselineChildJobs", baselineChildJobs)
      .put("finalNanoRtThreads", nanoRtThreadCount())
      .put("actor", snapshot.toJson())
      .put("error", error?.let { "${it::class.java.simpleName}: ${it.message}" } ?: JSONObject.NULL)
      .put("events", JSONArray(events.toList()))
      .put(
        "thresholds",
        JSONObject()
          .put("maxThreadDelta", config.maxThreadDelta)
          .put("maxChildJobDelta", config.maxChildJobDelta)
          .put("queueWaitP99Ms", config.queueWaitP99Ms)
          .put("holdP99Ms", config.holdP99Ms)
          .put("maxPendingReplies", config.maxPendingReplies),
      )

    store.writeReport(report)
  }

  private fun thresholdBreach(snapshot: InterpreterActor.DebugSnapshot, threadDelta: Int, childJobDelta: Int): String? {
    if (snapshot.fatalTerminationCount > 0) return "fatal_termination_count=${snapshot.fatalTerminationCount}"
    if (snapshot.pendingReplies > config.maxPendingReplies) return "pending_replies=${snapshot.pendingReplies}"
    if (threadDelta > config.maxThreadDelta) return "thread_delta=$threadDelta"
    if (childJobDelta > config.maxChildJobDelta) return "child_job_count=$childJobDelta"
    if (snapshot.queueWaitMs.samples > 50 && snapshot.queueWaitMs.p99 > config.queueWaitP99Ms) {
      return "queue_wait_p99=${snapshot.queueWaitMs.p99}"
    }
    if (snapshot.holdMs.samples > 50 && snapshot.holdMs.p99 > config.holdP99Ms) {
      return "hold_p99=${snapshot.holdMs.p99}"
    }
    return null
  }

  private fun pickModel(profile: String, iteration: Long): ModelId {
    return when (profile) {
      SoakControl.PROFILE_ROTATION -> {
        val seq = listOf(ModelId.RS, ModelId.BS, ModelId.SS, ModelId.EC, ModelId.IC)
        seq[(iteration % seq.size).toInt()]
      }

      SoakControl.PROFILE_SHUTDOWN -> if (iteration % 2L == 0L) ModelId.IC else ModelId.EC

      SoakControl.PROFILE_WORKFLOW_CLASSIFICATION -> {
        val seq = listOf(ModelId.IC, ModelId.EC)
        seq[(iteration % seq.size).toInt()]
      }

      SoakControl.PROFILE_WORKFLOW_SEGMENTATION -> {
        val seq = listOf(ModelId.RS, ModelId.BS, ModelId.SS)
        seq[(iteration % seq.size).toInt()]
      }

      else -> {
        val seq = listOf(ModelId.IC, ModelId.EC, ModelId.RS)
        seq[(iteration % seq.size).toInt()]
      }
    }
  }

  private fun nanoRtThreadCount(): Int {
    return Thread.getAllStackTraces().keys.count { it.isAlive && it.name.startsWith("NanoRT-Thread") }
  }

  private fun buildSessionId(): String {
    val fmt = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US)
    return "soak_${fmt.format(Date())}"
  }

  private fun notification(text: String): Notification {
    val channelId = "soak_runner"
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      if (manager.getNotificationChannel(channelId) == null) {
        val channel = NotificationChannel(channelId, "NanoRT Soak Runner", NotificationManager.IMPORTANCE_LOW)
        manager.createNotificationChannel(channel)
      }
    }

    return Notification.Builder(this, channelId)
      .setContentTitle("NanoRT Interpreter Soak")
      .setContentText(text)
      .setSmallIcon(android.R.drawable.stat_notify_sync)
      .setOngoing(true)
      .build()
  }

  companion object {
    private const val NOTIFICATION_ID = 3107
  }
}

private class SoakStore(private val context: Context, private val sessionId: String) {
  private val dir: File = File(context.filesDir, "soak/$sessionId").apply { mkdirs() }
  private val rootDir: File = File(context.filesDir, "soak").apply { mkdirs() }

  fun writeStatus(status: JSONObject) {
    val root = File(rootDir, "status.json")
    root.writeText(status.toString(2))
    File(dir, "status.json").writeText(status.toString(2))
  }

  fun writeReport(report: JSONObject) {
    val root = File(rootDir, "report.json")
    root.writeText(report.toString(2))
    File(dir, "report.json").writeText(report.toString(2))
  }
}

private fun InterpreterActor.DebugSnapshot.toJson(): JSONObject {
  return JSONObject()
    .put("lifecycle", lifecycle)
    .put("interpreterState", interpreterState)
    .put("currentModel", currentModel ?: JSONObject.NULL)
    .put("epoch", epoch)
    .put("ownerThreadName", ownerThreadName ?: JSONObject.NULL)
    .put("runtimePresent", runtimePresent)
    .put("shutdownInProgress", shutdownInProgress)
    .put("pendingReplies", pendingReplies)
    .put("maxPendingReplies", maxPendingReplies)
    .put("approxMailboxDepth", approxMailboxDepth)
    .put("enqueuedMessages", enqueuedMessages)
    .put("dequeuedMessages", dequeuedMessages)
    .put("runCount", runCount)
    .put("releaseCount", releaseCount)
    .put("shutdownCount", shutdownCount)
    .put("restartCount", restartCount)
    .put("fatalTerminationCount", fatalTerminationCount)
    .put("childJobCount", childJobCount)
    .put("gpuDelegateActive", gpuDelegateActive)
    .put("queueWaitMs", queueWaitMs.toJson())
    .put("holdMs", holdMs.toJson())
    .put("fatalError", fatalError ?: JSONObject.NULL)
}

private fun InterpreterActor.Stats.toJson(): JSONObject {
  return JSONObject()
    .put("samples", samples)
    .put("min", min)
    .put("p50", p50)
    .put("p95", p95)
    .put("p99", p99)
    .put("max", max)
}
