package expo.modules.nanort.module.workflows.field.pipelines

import android.graphics.Bitmap

import expo.modules.nanort.core.ModuleLogger
import expo.modules.nanort.core.logI
import expo.modules.nanort.core.logW
import expo.modules.nanort.module.interpreter.ModelId
import expo.modules.nanort.module.workflows.field.workflows.FieldClassificationResult
import expo.modules.nanort.module.workflows.field.workflows.FieldSegmentationResult
import expo.modules.nanort.module.workflows.shared.base.AbstractClassificationPipeline
import expo.modules.nanort.module.workflows.shared.classification.ClassificationConfig
import expo.modules.nanort.module.workflows.shared.classification.ClassificationConfigs
import expo.modules.nanort.module.workflows.shared.classification.ClassificationResult


class FieldInternalClassificationPipeline :
  AbstractClassificationPipeline<FieldSegmentationResult, FieldClassificationResult>() {

  private val TAG = ModuleLogger.createTag("FieldIntClsPipe")

  override fun getModelId(): ModelId = ModelId.IC
  override fun getConfig(): ClassificationConfig = ClassificationConfigs.Internal

  override fun getBitmapsToProcess(input: FieldSegmentationResult): List<Bitmap> =
    input.segmentedBitmaps

  private fun kv(vararg pairs: Pair<String, Any?>) =
    pairs.joinToString(" ") { (k, v) -> "$k=$v" }

  override fun buildOutput(
    input: FieldSegmentationResult,
    result: List<ClassificationResult>
  ): FieldClassificationResult {
    // Validaciones de consistencia:
    val inCount = input.segmentedBitmaps.size
    val outCount = result.size
    require(inCount == outCount) {
      "classification_count_mismatch " + kv("inputs" to inCount, "results" to outCount)
    }
    require(inCount > 0) { "segmented_bitmaps_empty" }

    // Para el flujo “internal”, esperamos exactamente 1 recorte/resultado.
    if (inCount != 1) {
      // No lanzamos para no acoplar reglas de negocio aquí; dejamos traza y tomamos el primero.
      logW(TAG) { "expected_single_segment " + kv("actual" to inCount) }
    }

    logI(TAG) { "build_output_ok " + kv("items" to outCount) }

    return FieldClassificationResult(
      classifications = result,
      segmentedBitmaps = input.segmentedBitmaps
    )
  }
}