package com.nanort.module.workflows.plant.workflows

import android.graphics.Bitmap
import com.nanort.core.ModuleLogger
import com.nanort.core.logD
import com.nanort.core.logI
import com.nanort.module.primitives.then
import com.nanort.module.workflows.plant.pipelines.PlantBunchSegmentationPipeline
import com.nanort.module.workflows.plant.pipelines.PlantExternalClassificationPipeline
import com.nanort.module.workflows.plant.pipelines.PlantInternalClassificationPipeline
import com.nanort.module.workflows.plant.pipelines.PlantRingSegmentationPipeline
import com.nanort.module.workflows.plant.pipelines.PlantSingleSegmentationPipeline

/**
 * Orchestrates the Plant module workflows.
 *
 * Flows:
 *  - Ring Segmentation → Bunch Segmentation → External Classification
 *  - Single Segmentation → Internal Classification
 *
 * Strong typing ensures each stage output matches the next stage input.
 */
class PlantWorkflow(
  plantRingSegmentationPipeline: PlantRingSegmentationPipeline,
  plantBunchSegmentationPipeline: PlantBunchSegmentationPipeline,
  plantSingleSegmentationPipeline: PlantSingleSegmentationPipeline,
  plantExternalClassificationPipeline: PlantExternalClassificationPipeline,
  plantInternalClassificationPipeline: PlantInternalClassificationPipeline,
) {

  private val TAG = ModuleLogger.createTag("PlantWorkflow")

  // Simple key-value formatter for structured logs
  private fun kv(vararg pairs: Pair<String, Any?>) =
    pairs.joinToString(" ") { (k, v) -> "$k=$v" }

  // External: Ring → Bunch → External Classification
  private val externalWorkflow =
    plantRingSegmentationPipeline then plantBunchSegmentationPipeline then plantExternalClassificationPipeline

  // Internal: Single → Internal Classification
  private val internalWorkflow =
    plantSingleSegmentationPipeline then plantInternalClassificationPipeline

  /**
   * Runs the full External classification workflow.
   * @param bitmap Input image (must not be recycled).
   * @return Structured external classification result.
   */
  suspend fun runExternalClassification(bitmap: Bitmap): PlantClassificationResult {
    require(!bitmap.isRecycled) { "plant_external_bitmap_recycled" }
    logI(TAG) { "run_external_begin " + kv("w" to bitmap.width, "h" to bitmap.height) }
    val initialInput = PlantInitialInput(bitmap)
    val result = externalWorkflow.execute(initialInput)
    logD(TAG) {
      "run_external_ok " + kv(
        "items" to result.classifications.size,
        "classifications" to result.classifications
      )
    }
    return result
  }

  /**
   * Runs the full Internal classification workflow.
   * @param bitmap Input image (must not be recycled).
   * @return Structured internal classification result.
   */
  suspend fun runInternalClassification(bitmap: Bitmap): PlantClassificationResult {
    require(!bitmap.isRecycled) { "plant_internal_bitmap_recycled" }
    logI(TAG) { "run_internal_begin " + kv("w" to bitmap.width, "h" to bitmap.height) }
    val initialInput = PlantInitialInput(bitmap)
    val result = internalWorkflow.execute(initialInput)
    logD(TAG) {
      "run_external_ok " + kv(
        "items" to result.classifications.size,
        "classifications" to result.classifications
      )
    }
    return result
  }
}
