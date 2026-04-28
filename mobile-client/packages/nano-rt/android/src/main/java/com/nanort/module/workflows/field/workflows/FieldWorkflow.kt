package com.nanort.module.workflows.field.workflows

import android.graphics.Bitmap
import com.nanort.core.ModuleLogger
import com.nanort.core.logD
import com.nanort.core.logI
import com.nanort.module.primitives.then
import com.nanort.module.workflows.field.pipelines.FieldExternalClassificationPipeline
import com.nanort.module.workflows.field.pipelines.FieldInternalClassificationPipeline
import com.nanort.module.workflows.field.pipelines.FieldSegmentationPipeline

/**
 * Orchestrates the pipelines for the Field module.
 *
 * This workflow coordinates:
 *  - Segmentation → External classification
 *  - Segmentation → Internal classification
 *
 * Both flows compose strongly-typed pipelines where the compiler guarantees
 * the output type of the previous stage matches the input type of the next one.
 */
class FieldWorkflow(
  segmentationPipeline: FieldSegmentationPipeline,
  externalClassificationPipeline: FieldExternalClassificationPipeline,
  internalClassificationPipeline: FieldInternalClassificationPipeline
) {

  private val TAG = ModuleLogger.createTag("FieldWorkflow")

  // Helper to render simple key-value logs
  private fun kv(vararg pairs: Pair<String, Any?>) =
    pairs.joinToString(" ") { (k, v) -> "$k=$v" }

  // 1) Segmentation → External classification
  private val externalWorkflow = segmentationPipeline then externalClassificationPipeline

  // 2) Segmentation → Internal classification
  private val internalWorkflow = segmentationPipeline then internalClassificationPipeline

  /**
   * Runs the full External classification workflow for a single bunch image.
   * @param bitmap Input image (must not be recycled).
   * @return Final external classification result.
   */
  suspend fun runExternalClassification(bitmap: Bitmap): FieldClassificationResult {
    require(!bitmap.isRecycled) { "field_external_bitmap_recycled" }
    logI(TAG) { "run_external_begin " + kv("w" to bitmap.width, "h" to bitmap.height) }
    val initialInput = FieldInitialInput(bitmap)
    val result = externalWorkflow.execute(initialInput)
    logD(TAG) {
      "run_external_ok " + kv(
        "items" to result.classifications.size,
        "classifications" to result.classifications,
      )
    }
    return result
  }

  /**
   * Runs the full Internal classification workflow for a single bunch image.
   * @param bitmap Input image (must not be recycled).
   * @return Final internal classification result.
   */
  suspend fun runInternalClassification(bitmap: Bitmap): FieldClassificationResult {
    require(!bitmap.isRecycled) { "field_internal_bitmap_recycled" }
    logI(TAG) { "run_internal_begin " + kv("w" to bitmap.width, "h" to bitmap.height) }
    val initialInput = FieldInitialInput(bitmap)
    val result = internalWorkflow.execute(initialInput)
    logD(TAG) {
      "run_internal_ok " + kv(
        "items" to result.classifications.size,
        "classifications" to result.classifications,
      )
    }
    return result
  }
}
