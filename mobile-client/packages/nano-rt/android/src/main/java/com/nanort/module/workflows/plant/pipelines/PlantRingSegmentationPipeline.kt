package com.nanort.module.workflows.plant.pipelines


import com.nanort.core.ModuleLogger
import com.nanort.core.logD
import com.nanort.core.logE
import com.nanort.core.logI
import com.nanort.module.interpreter.ModelId
import com.nanort.module.workflows.plant.workflows.PlantInitialInput
import com.nanort.module.workflows.plant.workflows.PlantRingResult
import com.nanort.module.workflows.shared.base.AbstractSegmentationPipeline
import com.nanort.module.workflows.shared.segmentation.Segment
import com.nanort.module.workflows.shared.segmentation.SegmentValidators.requireSingleSegment
import com.nanort.module.workflows.shared.segmentation.SegmentationConfig
import com.nanort.module.workflows.shared.segmentation.SegmentationConfigs
import com.nanort.module.workflows.shared.segmentation.SegmentationProcessor
import com.nanort.module.workflows.shared.segmentation.SegmentationWorkspace
import org.opencv.android.Utils
import org.opencv.core.Mat
import org.opencv.core.Size


class PlantRingSegmentationPipeline :
  AbstractSegmentationPipeline<PlantInitialInput, PlantRingResult>() {

  private val TAG = ModuleLogger.createTag("PlantRingSegPipe")

  override fun getModelId(): ModelId = ModelId.RS
  override fun getConfig(): SegmentationConfig = SegmentationConfigs.RING

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
  ): PlantRingResult {
    // Valida y obtiene el único segmento
    val ringSegment = requireSingleSegment(segments)

    logI(TAG) { "ring_extraction_begin segments=${segments.size}" }

    val ringSegmentedBitmap = try {
      SegmentationProcessor.extractCroppedSegments(
        sourceBitmap = input.bitmap,
        segments = listOf(ringSegment),
        targetSize = Size(640.0, 640.0), // tamaño esperado por el modelo siguiente
        ws = ws
      ).first()
    } catch (t: Throwable) {
      logE(TAG, t) { "ring_extraction_fail" }
      // Si fallara la extracción (raro), propaga como error no recuperable
      throw RuntimeException("Fallo extrayendo el aro segmentado.", t)
    }

    logD(TAG) { "ring_extraction_ok" }

    return PlantRingResult(
      sourceBitmap = input.bitmap,
      ringSegment = ringSegment,
      ringSegmentedBitmap = ringSegmentedBitmap
    )
  }
}
