package expo.modules.nanort.module.interpreter

import java.util.Locale

import expo.modules.nanort.core.WarmupManager
import expo.modules.nanort.core.logE
import expo.modules.nanort.core.logI
import expo.modules.nanort.core.logW

/**
 * Objeto responsable de ejecutar el pre-calentamiento de los modelos
 * al inicio de la aplicación para reducir la latencia de la primera inferencia.
 */
object InterpreterWarmer {
  private const val TAG = "InterpreterWarmer"

  private fun kv(vararg pairs: Pair<String, Any?>) =
    pairs.joinToString(" ") { (k, v) -> "$k=$v" }


  suspend fun warmUp() {
    // Define la lista de todos los modelos que quieres pre-calentar.
    val modelsToWarmUp = listOf(
      ModelId.SS, // Single Segmentation
      ModelId.EC, // External Classification
      ModelId.IC  // Internal Classification
    )

    require(modelsToWarmUp.isNotEmpty()) { "warmup_models_empty" }

    val startNs = System.nanoTime()
    var okCount = 0
    var failCount = 0

    logI(TAG) { "warmup_begin " + kv("count" to modelsToWarmUp.size, "thread" to Thread.currentThread().name) }

    try {
      // Itera sobre cada modelo, forzando al ModelManager a cargarlo y compilarlo.
      for (modelId in modelsToWarmUp) {
        val t0 = System.nanoTime()
        logI(TAG) { "warmup_model_begin " + kv("model" to modelId.name) }
        try {
          ModelManager.withInterpreter(modelId) {
            // El bloque puede estar vacío. La llamada a withInterpreter ya hace el trabajo.
          }
          okCount++
          val durMs = (System.nanoTime() - t0) / 1_000_000.0
          logI(TAG) { "warmup_model_ok " + kv("model" to modelId.name, "ms" to String.format(Locale.US, "%.3f", durMs)) }
        } catch (t: Throwable) {
          failCount++
          val durMs = (System.nanoTime() - t0) / 1_000_000.0
          logE(TAG, t) { "warmup_model_fail " + kv("model" to modelId.name, "ms" to String.format(Locale.US, "%.3f", durMs)) }
        }
      }

      // Al final, liberamos la última sesión para dejar el manager limpio
      // y listo para la primera petición real del usuario.
      runCatching { ModelManager.releaseCurrentSession() }
        .onFailure { e -> logW(TAG, e) { "warmup_release_session_fail" } }

      val totalMs = (System.nanoTime() - startNs) / 1_000_000.0
      logI(TAG) { "warmup_end " + kv("ok" to okCount, "fail" to failCount, "ms" to String.format(Locale.US, "%.3f", totalMs)) }
    } catch (t: Throwable) {
      logE(TAG, t) { "warmup_unexpected_error" }
    } finally {
      // Notificamos a la UI que el proceso ha terminado, pase lo que pase.
      runCatching { WarmupManager.onWarmupFinished() }
        .onFailure { e -> logW(TAG, e) { "warmup_notify_finish_fail" } }
    }
  }
}