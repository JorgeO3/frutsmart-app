package com.nanort.module.workflows.plant.pipelines

import android.graphics.Bitmap
import com.nanort.core.ModuleLogger
import com.nanort.core.logI
import com.nanort.module.workflows.shared.base.AbstractClassificationPipeline
import com.nanort.module.interpreter.ModelId
import com.nanort.module.workflows.plant.workflows.PlantBunchResult
import com.nanort.module.workflows.plant.workflows.PlantClassificationResult
import com.nanort.module.workflows.shared.classification.ClassificationConfig
import com.nanort.module.workflows.shared.classification.ClassificationConfigs
import com.nanort.module.workflows.shared.classification.ClassificationResult

class PlantExternalClassificationPipeline :
  AbstractClassificationPipeline<PlantBunchResult, PlantClassificationResult>() {

  private val TAG = ModuleLogger.createTag("PlantExtClsPipe")

  override fun getModelId(): ModelId = ModelId.EC
  override fun getConfig(): ClassificationConfig = ClassificationConfigs.External
  override fun getBitmapsToProcess(input: PlantBunchResult): List<Bitmap> = input.segmentedBitmaps

  private fun kv(vararg pairs: Pair<String, Any?>) =
    pairs.joinToString(" ") { (k, v) -> "$k=$v" }

  override fun buildOutput(
    input: PlantBunchResult,
    result: List<ClassificationResult>
  ): PlantClassificationResult {
    // Validación de consistencia: #resultados debe coincidir con #bitmaps a clasificar
    val inCount = input.segmentedBitmaps.size
    val outCount = result.size
    require(inCount == outCount) {
      "classification_count_mismatch " + kv("inputs" to inCount, "results" to outCount)
    }

    logI(TAG) { "build_output_ok " + kv("items" to outCount) }

    return PlantClassificationResult(
      classifications = result,
      segmentedBitmaps = input.segmentedBitmaps
    )
  }
}
