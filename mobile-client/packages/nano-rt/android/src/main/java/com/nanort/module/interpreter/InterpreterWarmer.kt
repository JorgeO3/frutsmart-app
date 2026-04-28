package com.nanort.module.interpreter

import java.util.Locale

import com.nanort.core.WarmupManager
import com.nanort.core.logE
import com.nanort.core.logI
import com.nanort.core.logW

/**
 * Objeto responsable de ejecutar el pre-calentamiento de los modelos
 * al inicio de la aplicación para reducir la latencia de la primera inferencia.
 */
object InterpreterWarmer {
  private const val TAG = "InterpreterWarmer"

  private fun kv(vararg pairs: Pair<String, Any?>) =
    pairs.joinToString(" ") { (k, v) -> "$k=$v" }


  data class ModelFailure(
    val modelId: ModelId,
    val error: Throwable,
  )

  data class WarmupResult(
    val attemptedModels: List<ModelId>,
    val succeededCount: Int,
    val failed: List<ModelFailure>,
    val elapsedMs: Double,
  ) {
    val failedCount: Int get() = failed.size
    val isSuccessful: Boolean get() = failed.isEmpty()
  }

  class WarmupFailedException(val result: WarmupResult) : IllegalStateException(
    "warmup_failed succeeded=${result.succeededCount} failed=${result.failedCount}"
  )

  private val defaultModelsToWarmUp = listOf(
    ModelId.RS,
    ModelId.BS,
    ModelId.SS,
    ModelId.EC,
    ModelId.IC,
  )

  suspend fun warmUp(
    modelsToWarmUp: List<ModelId> = defaultModelsToWarmUp,
    runModelWarmup: suspend (ModelId) -> Unit = { modelId ->
      ModelManager.withInterpreter(modelId) { }
    },
    releaseSession: suspend () -> Unit = {
      ModelManager.releaseCurrentSession()
    },
    notifyFinished: () -> Unit = {
      WarmupManager.onWarmupFinished()
    },
  ): WarmupResult {

    require(modelsToWarmUp.isNotEmpty()) { "warmup_models_empty" }

    val startNs = System.nanoTime()
    var okCount = 0
    val failures = mutableListOf<ModelFailure>()

    logI(TAG) { "warmup_begin " + kv("count" to modelsToWarmUp.size, "thread" to Thread.currentThread().name) }

    try {
      for (modelId in modelsToWarmUp) {
        val t0 = System.nanoTime()
        logI(TAG) { "warmup_model_begin " + kv("model" to modelId.name) }
        try {
          runModelWarmup(modelId)
          okCount++
          val durMs = (System.nanoTime() - t0) / 1_000_000.0
          logI(TAG) { "warmup_model_ok " + kv("model" to modelId.name, "ms" to String.format(Locale.US, "%.3f", durMs)) }
        } catch (t: Throwable) {
          val durMs = (System.nanoTime() - t0) / 1_000_000.0
          failures += ModelFailure(modelId = modelId, error = t)
          logE(TAG, t) { "warmup_model_fail " + kv("model" to modelId.name, "ms" to String.format(Locale.US, "%.3f", durMs)) }
        }
      }

      runCatching { releaseSession() }
        .onFailure { e -> logW(TAG, e) { "warmup_release_session_fail" } }

      val totalMs = (System.nanoTime() - startNs) / 1_000_000.0
      val result = WarmupResult(
        attemptedModels = modelsToWarmUp,
        succeededCount = okCount,
        failed = failures.toList(),
        elapsedMs = totalMs,
      )

      logI(TAG) {
        "warmup_end " + kv(
          "ok" to result.succeededCount,
          "fail" to result.failedCount,
          "ms" to String.format(Locale.US, "%.3f", totalMs)
        )
      }

      if (!result.isSuccessful) {
        throw WarmupFailedException(result)
      }

      return result
    } finally {
      // Notificamos a la UI que el proceso ha terminado, pase lo que pase.
      runCatching { notifyFinished() }
        .onFailure { e -> logW(TAG, e) { "warmup_notify_finish_fail" } }
    }
  }
}
