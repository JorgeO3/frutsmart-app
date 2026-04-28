package expo.modules.nanort.module.interpreter.internal

import android.content.Context
import android.content.SharedPreferences
import android.os.Build
import androidx.core.content.edit
import expo.modules.nanort.core.AppAssets
import expo.modules.nanort.module.interpreter.ModelId

internal class GpuQuarantineStore(
  private val context: Context = AppAssets.getContext(),
  private val preferencesOverride: SharedPreferences? = null,
) {

  private val preferences: SharedPreferences by lazy {
    preferencesOverride ?: context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
  }

  fun isQuarantined(modelId: ModelId): Boolean {
    return preferences.getBoolean(buildQuarantineKey(modelId), false)
  }

  fun setQuarantined(modelId: ModelId, value: Boolean) {
    preferences.edit(commit = true) {
      putBoolean(buildQuarantineKey(modelId), value)
    }
  }

  fun setQuarantinedWithReason(modelId: ModelId, reason: String) {
    val truncatedReason = reason.take(MAX_REASON_LENGTH)

    preferences.edit(commit = true) {
      putBoolean(buildQuarantineKey(modelId), true)
      putString(buildReasonKey(modelId), truncatedReason)
    }
  }

  fun getLastReason(modelId: ModelId): String? {
    return preferences.getString(buildReasonKey(modelId), null)
  }

  @Deprecated("Use getLastReason")
  fun lastReason(modelId: ModelId): String? = getLastReason(modelId)

  fun clear(modelId: ModelId) {
    preferences.edit(commit = true) {
      remove(buildQuarantineKey(modelId))
      remove(buildReasonKey(modelId))
    }
  }

  fun clearAll() {
    preferences.edit(commit = true) {
      clear()
    }
  }

  private fun buildQuarantineKey(modelId: ModelId): String {
    return buildKey(KEY_PREFIX_QUARANTINE, modelId)
  }

  private fun buildReasonKey(modelId: ModelId): String {
    return "${buildKey(KEY_PREFIX_QUARANTINE, modelId)}$KEY_SUFFIX_REASON"
  }

  private fun buildKey(prefix: String, modelId: ModelId): String {
    return "${prefix}_${Build.FINGERPRINT}_${modelId.name}"
  }

  fun getQuarantinedModels(): List<ModelId> {
    return ModelId.entries.filter { modelId ->
      isQuarantined(modelId)
    }
  }

  fun exportState(): Map<ModelId, QuarantineState> {
    return ModelId.entries.associateWith { modelId ->
      QuarantineState(
        isQuarantined = isQuarantined(modelId),
        reason = getLastReason(modelId)
      )
    }
  }

  data class QuarantineState(
    val isQuarantined: Boolean,
    val reason: String?
  )

  private companion object {
    const val PREFERENCES_NAME = "tflite_gpu_quarantine"
    const val KEY_PREFIX_QUARANTINE = "q"
    const val KEY_SUFFIX_REASON = "_reason"
    const val MAX_REASON_LENGTH = 180
  }
}
