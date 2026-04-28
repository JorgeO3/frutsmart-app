package com.nanort.module.workflows.field.pipelines

import android.graphics.Bitmap
import com.nanort.core.ModuleLogger
import com.nanort.core.logI
import com.nanort.core.logW
import com.nanort.module.interpreter.ModelId
import com.nanort.module.workflows.field.workflows.FieldClassificationResult
import com.nanort.module.workflows.field.workflows.FieldSegmentationResult
import com.nanort.module.workflows.shared.base.AbstractClassificationPipeline
import com.nanort.module.workflows.shared.classification.ClassificationConfig
import com.nanort.module.workflows.shared.classification.ClassificationConfigs
import com.nanort.module.workflows.shared.classification.ClassificationResult


class FieldExternalClassificationPipeline :
  AbstractClassificationPipeline<FieldSegmentationResult, FieldClassificationResult>() {

  private val TAG = ModuleLogger.createTag("FieldExtClsPipe")

  override fun getModelId(): ModelId = ModelId.EC
  override fun getConfig(): ClassificationConfig = ClassificationConfigs.External
  override fun getBitmapsToProcess(input: FieldSegmentationResult): List<Bitmap> = input.segmentedBitmaps

  private fun kv(vararg pairs: Pair<String, Any?>) =
    pairs.joinToString(" ") { (k, v) -> "$k=$v" }

  override fun buildOutput(
    input: FieldSegmentationResult,
    result: List<ClassificationResult>
  ): FieldClassificationResult {
    val inCount = input.segmentedBitmaps.size
    val outCount = result.size
    require(inCount == outCount) {
      "classification_count_mismatch inputs=$inCount results=$outCount"
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