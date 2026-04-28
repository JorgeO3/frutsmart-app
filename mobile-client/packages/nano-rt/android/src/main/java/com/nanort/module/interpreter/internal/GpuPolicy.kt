package com.nanort.module.interpreter.internal

import android.os.Build
import com.nanort.core.ModuleLogger
import com.nanort.core.logW
import com.nanort.module.interpreter.ModelId
import org.tensorflow.lite.gpu.CompatibilityList

internal class GpuPolicy(
  private val compat: CompatibilityList,
  private val quarantine: GpuQuarantineStore,
  private val compatSupportedOverride: (() -> Boolean)? = null,
  private val buildInfo: BuildInfo = BuildInfo.fromDevice(),
) {
  private val tag = ModuleLogger.createTag("GpuPolicy")

  private val fingerprintBlacklistExact: Map<String, Set<ModelId>> = mapOf(
    "motorola/bangkk_g/bangkk:14/U1TCS34.22-64-19-4-6/f9a73f-132e5c3:user/release-keys" to setOf(ModelId.RS),
    "motorola/bangkk_g/bangkk:15/V1TCS35H.88-16-1/d09472-674756:user/release-keys" to setOf(ModelId.RS),
  )

  private val fingerprintBlacklistPrefix: Map<String, Set<ModelId>> = mapOf(
    "motorola/bangkk_g/bangkk:" to setOf(ModelId.RS),
  )

  private val deviceSignatureBlacklist: Map<String, Set<ModelId>> = mapOf(
    "motorola|*|bangkk|*" to setOf(ModelId.RS),
  )

  fun shouldUseGpu(modelId: ModelId): Boolean {
    if (!InferenceFlags.gpuEnabled) return false

    if (isBlacklisted(modelId)) {
      logW(tag) {
        "gpu_blacklisted model=${modelId.name} " +
            "fingerprint=${Build.FINGERPRINT} " +
            "sig=${deviceSignature()}"
      }
      return false
    }

    val isSupported = compatSupportedOverride?.invoke() ?: compat.isDelegateSupportedOnThisDevice
    if (!isSupported) {
      logW(tag) { "gpu_unsupported_device" }
      return false
    }

    if (quarantine.isQuarantined(modelId)) {
      logW(tag) { "gpu_quarantined model=${modelId.name} reason=${quarantine.getLastReason(modelId)}" }
      return false
    }

    return true
  }

  fun quarantine(modelId: ModelId, reason: String) {
    logW(tag) { "gpu_quarantine_set model=${modelId.name} reason=${reason.take(120)}" }
    quarantine.setQuarantinedWithReason(modelId, reason)
  }

  fun clearQuarantine(modelId: ModelId) {
    quarantine.clear(modelId)
  }

  private fun isBlacklisted(modelId: ModelId): Boolean {
    val fp = buildInfo.fingerprint
    fingerprintBlacklistExact[fp]?.let { models ->
      if (modelId in models) return true
    }

    val fpLower = fp.lowercase()
    for ((prefix, models) in fingerprintBlacklistPrefix) {
      if (fpLower.startsWith(prefix.lowercase()) && modelId in models) return true
    }

    val sig = deviceSignature()
    for ((pattern, models) in deviceSignatureBlacklist) {
      if (signatureMatches(sig, pattern) && modelId in models) return true
    }

    return false
  }

  private fun deviceSignature(): String {
    val man = buildInfo.manufacturer
    val model = buildInfo.model
    val device = buildInfo.device
    val hw = buildInfo.hardware
    return "$man|$model|$device|$hw"
  }

  internal data class BuildInfo(
    val fingerprint: String,
    val manufacturer: String,
    val model: String,
    val device: String,
    val hardware: String,
  ) {
    companion object {
      fun fromDevice(): BuildInfo {
        return BuildInfo(
          fingerprint = Build.FINGERPRINT.orEmpty(),
          manufacturer = Build.MANUFACTURER.orEmpty().lowercase(),
          model = Build.MODEL.orEmpty().lowercase(),
          device = Build.DEVICE.orEmpty().lowercase(),
          hardware = Build.HARDWARE.orEmpty().lowercase(),
        )
      }
    }
  }

  private fun signatureMatches(actualSig: String, patternSig: String): Boolean {
    val a = actualSig.split("|")
    val p = patternSig.lowercase().split("|")
    if (a.size != 4 || p.size != 4) return false

    for (i in 0 until 4) {
      val want = p[i]
      if (want == ANY) continue
      if (a[i] != want) return false
    }
    return true
  }

  private companion object {
    const val ANY = "*"
  }
}
