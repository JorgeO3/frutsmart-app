package com.nanort.module.workflows.plant.pipelines

import org.opencv.core.Mat
import org.opencv.core.Size
import org.opencv.android.Utils
import com.nanort.core.ModuleLogger
import com.nanort.core.logD
import com.nanort.core.logE
import com.nanort.core.logI
import com.nanort.module.workflows.shared.base.AbstractSegmentationPipeline
import com.nanort.module.interpreter.ModelId
import com.nanort.module.workflows.plant.workflows.PlantInitialInput
import com.nanort.module.workflows.plant.workflows.PlantSingleResult
import com.nanort.module.workflows.shared.segmentation.Segment
import com.nanort.module.workflows.shared.segmentation.SegmentationConfig
import com.nanort.module.workflows.shared.segmentation.SegmentationConfigs
import com.nanort.module.workflows.shared.segmentation.SegmentationProcessor
import com.nanort.module.workflows.shared.segmentation.SegmentationWorkspace
import com.nanort.module.workflows.shared.segmentation.SegmentValidators.requireSingleSegment

class PlantSingleSegmentationPipeline :
  AbstractSegmentationPipeline<PlantInitialInput, PlantSingleResult>() {

  private val TAG = ModuleLogger.createTag("PlantSingleSegPipe")

  override fun getModelId(): ModelId = ModelId.SS
  override fun getConfig(): SegmentationConfig = SegmentationConfigs.SINGLE

  private fun kv(vararg pairs: Pair<String, Any?>) =
    pairs.joinToString(" ") { (k, v) -> "$k=$v" }

  override fun getBitmap(input: PlantInitialInput): Mat {
    require(!input.bitmap.isRecycled) { "input_bitmap_recycled" }
    return Mat().apply { Utils.bitmapToMat(input.bitmap, this) }
  }

  override fun buildOutput(
    input: PlantInitialInput,
    segments: List<Segment>,
    ws: SegmentationWorkspace
  ): PlantSingleResult {
    // Requiere exactamente 1 segmento (genérico y reutilizable)
    val single = requireSingleSegment(segments, entity = "objeto")

    logI(TAG) { "single_extraction_begin " + kv("segments" to segments.size) }

    val segmentedBitmaps = try {
      SegmentationProcessor.extractCroppedSegments(
        segments = listOf(single),
        sourceBitmap = input.bitmap,
        targetSize = Size(224.0, 224.0),
        ws = ws
      )
    } catch (t: Throwable) {
      logE(TAG, t) { "single_extraction_fail" }
      throw RuntimeException("Fallo extrayendo el recorte del objeto.", t)
    }

    logD(TAG) { "single_extraction_ok " + kv("count" to segmentedBitmaps.size) }

    return PlantSingleResult(
      sourceBitmap = input.bitmap,
      segmentedBitmaps = segmentedBitmaps
    )
  }
}
