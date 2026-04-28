package expo.modules.nanort.module.workflows.plant.pipelines

import org.opencv.core.Mat
import org.opencv.core.Size
import org.opencv.android.Utils
import expo.modules.nanort.core.ModuleLogger
import expo.modules.nanort.core.logD
import expo.modules.nanort.core.logE
import expo.modules.nanort.core.logI
import expo.modules.nanort.module.workflows.shared.base.AbstractSegmentationPipeline
import expo.modules.nanort.module.interpreter.ModelId
import expo.modules.nanort.module.workflows.plant.workflows.PlantInitialInput
import expo.modules.nanort.module.workflows.plant.workflows.PlantSingleResult
import expo.modules.nanort.module.workflows.shared.segmentation.Segment
import expo.modules.nanort.module.workflows.shared.segmentation.SegmentationConfig
import expo.modules.nanort.module.workflows.shared.segmentation.SegmentationConfigs
import expo.modules.nanort.module.workflows.shared.segmentation.SegmentationProcessor
import expo.modules.nanort.module.workflows.shared.segmentation.SegmentationWorkspace
import expo.modules.nanort.module.workflows.shared.segmentation.SegmentValidators.requireSingleSegment

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
