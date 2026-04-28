package expo.modules.nanort.module.workflows.shared.base

import android.graphics.Bitmap
import java.util.Locale

import expo.modules.nanort.core.ModuleLogger
import expo.modules.nanort.core.logD
import expo.modules.nanort.core.logE
import expo.modules.nanort.core.logI
import expo.modules.nanort.core.logW

import expo.modules.nanort.module.interpreter.ModelId
import expo.modules.nanort.module.interpreter.ModelManager
import expo.modules.nanort.module.interpreter.WorkspaceManager
import expo.modules.nanort.module.primitives.Pipeline
import expo.modules.nanort.module.workflows.shared.classification.ClassificationConfig
import expo.modules.nanort.module.workflows.shared.classification.ClassificationProcessor
import expo.modules.nanort.module.workflows.shared.classification.ClassificationResult


abstract class AbstractClassificationPipeline<I : Any, O : Any> : Pipeline<I, O> {
  sealed class ClassificationPipelineException(message: String, cause: Throwable? = null) :
    RuntimeException(message, cause)

  class InvalidModelInputShapeException(message: String) :
    ClassificationPipelineException(message)

  class PreprocessException(message: String, cause: Throwable? = null) :
    ClassificationPipelineException(message, cause)

  class InferenceStepException(message: String, cause: Throwable? = null) :
    ClassificationPipelineException(message, cause)

  class PostprocessException(message: String, cause: Throwable? = null) :
    ClassificationPipelineException(message, cause)

  private val TAG = ModuleLogger.createTag("AbstractClsPipeline")

  protected abstract fun getModelId(): ModelId
  protected abstract fun getConfig(): ClassificationConfig
  protected abstract fun getBitmapsToProcess(input: I): List<Bitmap>
  protected abstract fun buildOutput(input: I, result: List<ClassificationResult>): O

  private fun kv(vararg pairs: Pair<String, Any?>) =
    pairs.joinToString(" ") { (k, v) -> "$k=$v" }

  override suspend fun execute(input: I): O {
    val modelId = getModelId()
    val config = getConfig()
    // Conservamos las labels en config para que RN pueda mapear índices->nombre de clase
    require(config.labels.isNotEmpty()) { "classification_labels_empty" }

    logI(TAG) { "pipeline_begin " + kv("model" to modelId.name) }

    return ModelManager.withInterpreter(modelId) { interpreter ->
      WorkspaceManager.useClassificationWorkspace { workspace ->
        val inputShape = interpreter.getInputTensorShape()
        // Validación de shape: 4D y cuadrado (N,H,W,C)
        if (inputShape == null || inputShape.size != 4 || inputShape[1] != inputShape[2]) {
          val msg = "invalid_model_input_shape " + kv(
            "shape" to (inputShape?.contentToString() ?: "null")
          )
          logE(TAG) { msg }
          throw InvalidModelInputShapeException(
            "Forma de entrada inesperada: ${inputShape?.contentToString()}"
          )
        }
        val modelInputSize = inputShape[1]

        val inputBuffer = interpreter.getInputBuffer()
        val bitmapsToProcess = getBitmapsToProcess(input)
        require(bitmapsToProcess.isNotEmpty()) { "bitmaps_to_process_empty" }

        val rawOutputs = ArrayList<FloatArray>(bitmapsToProcess.size)

        val t0 = System.nanoTime()
        var ok = 0
        var fail = 0

        try {
          bitmapsToProcess.forEachIndexed { idx, bitmap ->
            val imgStart = System.nanoTime()
            logD(TAG) {
              "img_begin " + kv(
                "idx" to idx,
                "w" to bitmap.width,
                "h" to bitmap.height,
                "inputSize" to modelInputSize
              )
            }

            // -------- Preprocess --------
            try {
              ClassificationProcessor.preprocess(bitmap, inputBuffer, workspace, modelInputSize)
            } catch (t: Throwable) {
              fail++
              val ms = (System.nanoTime() - imgStart) / 1_000_000.0
              logE(TAG, t) { "preprocess_fail " + kv("idx" to idx, "ms" to String.format(Locale.US, "%.3f", ms)) }
              throw PreprocessException("Fallo en preprocesado de la imagen idx=$idx", t)
            }

            // -------- Inference --------
            val infStart = System.nanoTime()
            try {
              interpreter.runInference()
            } catch (t: Throwable) {
              fail++
              val ms = (System.nanoTime() - infStart) / 1_000_000.0
              logE(TAG, t) { "inference_fail " + kv("idx" to idx, "ms" to String.format(Locale.US, "%.3f", ms)) }
              throw InferenceStepException("Fallo en inferencia para idx=$idx", t)
            }

            // -------- Lectura salidas (crudas) + logging por imagen --------
            val confidences = ClassificationProcessor.extractConfidences(
              outputs = interpreter.getOutputBuffers(),
              idx = idx,
              imgStartNs = imgStart,
              infStartNs = infStart
            )
            rawOutputs.add(confidences)
            ok++
          }

          val totalMs = (System.nanoTime() - t0) / 1_000_000.0
          logI(TAG) { "pipeline_ok " + kv("ok" to ok, "fail" to fail, "ms" to String.format(Locale.US, "%.3f", totalMs)) }

          // -------- Construcción de salida: 1 resultado por imagen, con TODAS las confidencias --------
          val results = rawOutputs.map { arr -> ClassificationResult(confidences = arr) }
          return@useClassificationWorkspace buildOutput(input, results)
        } finally {
          if (fail > 0) {
            logW(TAG) { "pipeline_partial_fail " + kv("ok" to ok, "fail" to fail) }
          }
          // Si llegas a crear bitmaps temporales aquí, recíclalos.
          // bitmapsToProcess.forEach { if (!it.isRecycled) it.recycle() }
        }
      }
    }
  }
}
