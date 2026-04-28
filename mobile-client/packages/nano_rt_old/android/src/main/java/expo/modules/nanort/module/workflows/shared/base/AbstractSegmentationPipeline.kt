package expo.modules.nanort.module.workflows.shared.base

import java.util.Locale
import org.opencv.core.Mat

import expo.modules.nanort.core.ModuleLogger
import expo.modules.nanort.core.logD
import expo.modules.nanort.core.logE
import expo.modules.nanort.core.logI
import expo.modules.nanort.module.opencv.use
import expo.modules.nanort.module.interpreter.ModelId
import expo.modules.nanort.module.interpreter.ModelManager
import expo.modules.nanort.module.primitives.Pipeline
import expo.modules.nanort.module.interpreter.WorkspaceManager
import expo.modules.nanort.module.workflows.shared.segmentation.Segment
import expo.modules.nanort.module.workflows.shared.segmentation.SegmentationConfig
import expo.modules.nanort.module.workflows.shared.segmentation.SegmentationProcessor
import expo.modules.nanort.module.workflows.shared.segmentation.SegmentationWorkspace


abstract class AbstractSegmentationPipeline<I : Any, O : Any> : Pipeline<I, O> {

  // ---------------- Excepciones específicas de la pipeline ----------------
  sealed class SegmentationPipelineException(message: String, cause: Throwable? = null) :
    RuntimeException(message, cause)

  class InvalidModelInputShapeException(message: String) :
    SegmentationPipelineException(message)

  class PreprocessException(message: String, cause: Throwable? = null) :
    SegmentationPipelineException(message, cause)

  class InferenceStepException(message: String, cause: Throwable? = null) :
    SegmentationPipelineException(message, cause)

  class PostprocessException(message: String, cause: Throwable? = null) :
    SegmentationPipelineException(message, cause)
  // -----------------------------------------------------------------------

  private val TAG = ModuleLogger.createTag("AbstractSegPipeline")

  protected abstract fun getModelId(): ModelId
  protected abstract fun getConfig(): SegmentationConfig
  protected abstract fun getBitmap(input: I): Mat
  protected abstract fun buildOutput(input: I, segments: List<Segment>, ws: SegmentationWorkspace): O


  private fun kv(vararg pairs: Pair<String, Any?>) =
    pairs.joinToString(" ") { (k, v) -> "$k=$v" }


  /// Ejecuta toda la lógica bajo el intérprete y el workspace seguros
  override suspend fun execute(input: I): O {
    val modelId = getModelId()
    val config = getConfig() // si en el futuro validas thresholds, haz require(...) aquí

    logI(TAG) { "pipeline_begin " + kv("model" to modelId.name) }

    return ModelManager.withInterpreter(modelId) { interpreter ->
      WorkspaceManager.useSegmentationWorkspace { segWorkspace ->
        getBitmap(input).use { srcMat ->
          // Validación del input visual
          require(!srcMat.empty()) {
            "input_mat_empty " + kv("model" to modelId.name)
          }
          logD(TAG) { "input_mat " + kv("w" to srcMat.width(), "h" to srcMat.height(), "c" to srcMat.channels()) }

          // Validación de shape del modelo (esperamos 4D: N,H,W,C)
          val inShape = interpreter.getInputTensorShape()
          if (inShape == null || inShape.size != 4) {
            val shapeStr = inShape?.contentToString() ?: "null"
            logE(TAG) { "invalid_model_input_shape " + kv("shape" to shapeStr) }
            throw InvalidModelInputShapeException("Forma de entrada inesperada: $shapeStr")
          }

          val totalStart = System.nanoTime()

          // -------- Preprocesado --------
          val prepStart = System.nanoTime()
          val meta = try {
            SegmentationProcessor.preprocess(srcMat, interpreter.getInputBuffer(), segWorkspace)
          } catch (t: Throwable) {
            val ms = (System.nanoTime() - prepStart) / 1_000_000.0
            logE(TAG, t) { "preprocess_fail " + kv("ms" to String.format(Locale.US, "%.3f", ms)) }
            throw PreprocessException("Fallo en preprocesado", t)
          }
          val prepMs = (System.nanoTime() - prepStart) / 1_000_000.0
          logD(TAG) { "preprocess_ok " + kv("ms" to String.format(Locale.US, "%.3f", prepMs)) }

          // -------- Tensor shapes / preparación de workspace --------
          val rawTensorShapes = interpreter.getOutputTensorShapes()
          val tensorShapes = SegmentationProcessor.parseTensorShapes(rawTensorShapes)
          segWorkspace.prepareFor(tensorShapes)

          // -------- Inferencia --------
          val infStart = System.nanoTime()
          try {
            interpreter.runInference()
          } catch (t: Throwable) {
            val ms = (System.nanoTime() - infStart) / 1_000_000.0
            logE(TAG, t) { "inference_fail " + kv("ms" to String.format(Locale.US, "%.3f", ms)) }
            throw InferenceStepException("Fallo en inferencia", t)
          }
          val infMs = (System.nanoTime() - infStart) / 1_000_000.0
          logD(TAG) { "inference_ok " + kv("ms" to String.format(Locale.US, "%.3f", infMs)) }

          // -------- Postprocesado --------
          val postStart = System.nanoTime()
          val segments = try {
            SegmentationProcessor.postprocess(
              interpreter.getOutputBuffers(),
              meta,
              tensorShapes,
              segWorkspace,
              config
            )
          } catch (t: Throwable) {
            val ms = (System.nanoTime() - postStart) / 1_000_000.0
            logE(TAG, t) { "postprocess_fail " + kv("ms" to String.format(Locale.US, "%.3f", ms)) }
            throw PostprocessException("Fallo en postprocesado", t)
          }
          val postMs = (System.nanoTime() - postStart) / 1_000_000.0
          val totalMs = (System.nanoTime() - totalStart) / 1_000_000.0

          logI(TAG) {
            "pipeline_ok " + kv(
              "segments" to segments.size,
              "prepMs" to String.format(Locale.US, "%.3f", prepMs),
              "infMs" to String.format(Locale.US, "%.3f", infMs),
              "postMs" to String.format(Locale.US, "%.3f", postMs),
              "totalMs" to String.format(Locale.US, "%.3f", totalMs)
            )
          }

          // Construye la salida específica del dominio
          buildOutput(input, segments, ws = segWorkspace)
        }
      }
    }
  }
}