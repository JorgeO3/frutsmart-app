package expo.modules.nanort.module.workflows.plant.pipelines

import android.graphics.Bitmap
import expo.modules.nanort.core.ModuleLogger
import expo.modules.nanort.core.logI
import expo.modules.nanort.module.workflows.shared.base.AbstractClassificationPipeline
import expo.modules.nanort.module.interpreter.ModelId
import expo.modules.nanort.module.workflows.plant.workflows.PlantClassificationResult
import expo.modules.nanort.module.workflows.plant.workflows.PlantSingleResult
import expo.modules.nanort.module.workflows.shared.classification.ClassificationConfig
import expo.modules.nanort.module.workflows.shared.classification.ClassificationConfigs
import expo.modules.nanort.module.workflows.shared.classification.ClassificationResult

class PlantInternalClassificationPipeline :
  AbstractClassificationPipeline<PlantSingleResult, PlantClassificationResult>() {

  private val TAG = ModuleLogger.createTag("PlantIntClsPipe")

  override fun getModelId(): ModelId = ModelId.IC
  override fun getConfig(): ClassificationConfig = ClassificationConfigs.Internal
  override fun getBitmapsToProcess(input: PlantSingleResult): List<Bitmap> = input.segmentedBitmaps

  private fun kv(vararg pairs: Pair<String, Any?>) =
    pairs.joinToString(" ") { (k, v) -> "$k=$v" }

  override fun buildOutput(
    input: PlantSingleResult,
    result: List<ClassificationResult>
  ): PlantClassificationResult {
    // Validación de consistencia: #resultados == #bitmaps de entrada
    val inCount = input.segmentedBitmaps.size
    val outCount = result.size
    require(inCount == outCount) {
      "classification_count_mismatch " + kv("inputs" to inCount, "results" to outCount)
    }

    logI(TAG) { "build_output_ok " + kv("items" to outCount) }

    // Mantenemos los bitmaps segmentados; NO se reciclan en la base.
    return PlantClassificationResult(
      classifications = result,
      segmentedBitmaps = input.segmentedBitmaps
    )
  }
}
