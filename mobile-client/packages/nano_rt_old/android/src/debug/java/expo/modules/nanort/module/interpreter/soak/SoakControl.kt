package expo.modules.nanort.module.interpreter.soak

import android.content.Intent
import expo.modules.nanort.BuildConfig

internal object SoakControl {
  const val ACTION_START = BuildConfig.LIBRARY_PACKAGE_NAME + ".soak.START"
  const val ACTION_STOP = BuildConfig.LIBRARY_PACKAGE_NAME + ".soak.STOP"

  const val EXTRA_PROFILE = "profile"
  const val EXTRA_DURATION_MINUTES = "durationMinutes"
  const val EXTRA_GPU_ENABLED = "gpuEnabled"
  const val EXTRA_FAIL_FAST = "failFast"
  const val EXTRA_MAX_THREAD_DELTA = "maxThreadDelta"
  const val EXTRA_MAX_CHILD_JOB_DELTA = "maxChildJobDelta"
  const val EXTRA_QUEUE_WAIT_P99_MS = "queueWaitP99Ms"
  const val EXTRA_HOLD_P99_MS = "holdP99Ms"
  const val EXTRA_MAX_PENDING_REPLIES = "maxPendingReplies"

  const val PROFILE_MIXED = "mixed"
  const val PROFILE_ROTATION = "rotation"
  const val PROFILE_SHUTDOWN = "shutdown"
  const val PROFILE_WORKFLOW_CLASSIFICATION = "workflow_classification"
  const val PROFILE_WORKFLOW_SEGMENTATION = "workflow_segmentation"

  fun configFromIntent(intent: Intent): SoakConfig {
    return SoakConfig(
      profile = intent.getStringExtra(EXTRA_PROFILE) ?: PROFILE_MIXED,
      durationMinutes = intent.getIntExtra(EXTRA_DURATION_MINUTES, 0),
      gpuEnabled = intent.getBooleanExtra(EXTRA_GPU_ENABLED, false),
      failFast = intent.getBooleanExtra(EXTRA_FAIL_FAST, true),
      maxThreadDelta = intent.getIntExtra(EXTRA_MAX_THREAD_DELTA, 1),
      maxChildJobDelta = intent.getIntExtra(EXTRA_MAX_CHILD_JOB_DELTA, 4),
      queueWaitP99Ms = intent.getDoubleExtra(EXTRA_QUEUE_WAIT_P99_MS, 5_000.0),
      holdP99Ms = intent.getDoubleExtra(EXTRA_HOLD_P99_MS, 5_000.0),
      maxPendingReplies = intent.getIntExtra(EXTRA_MAX_PENDING_REPLIES, 128),
    )
  }
}

internal data class SoakConfig(
  val profile: String,
  val durationMinutes: Int,
  val gpuEnabled: Boolean,
  val failFast: Boolean,
  val maxThreadDelta: Int,
  val maxChildJobDelta: Int,
  val queueWaitP99Ms: Double,
  val holdP99Ms: Double,
  val maxPendingReplies: Int,
) {
  val indefinite: Boolean get() = durationMinutes <= 0
}
