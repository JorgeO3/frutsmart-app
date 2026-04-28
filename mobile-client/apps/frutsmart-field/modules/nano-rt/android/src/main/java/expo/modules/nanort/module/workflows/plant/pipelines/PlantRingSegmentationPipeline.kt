package expo.modules.nanort.module.workflows.plant.pipelines


import expo.modules.nanort.core.ModuleLogger
import expo.modules.nanort.core.logD
import expo.modules.nanort.core.logE
import expo.modules.nanort.core.logI
import expo.modules.nanort.module.interpreter.ModelId
import expo.modules.nanort.module.workflows.plant.workflows.PlantInitialInput
import expo.modules.nanort.module.workflows.plant.workflows.PlantRingResult
import expo.modules.nanort.module.workflows.shared.base.AbstractSegmentationPipeline
import expo.modules.nanort.module.workflows.shared.segmentation.Segment
import expo.modules.nanort.module.workflows.shared.segmentation.SegmentValidators.requireSingleSegment
import expo.modules.nanort.module.workflows.shared.segmentation.SegmentationConfig
import expo.modules.nanort.module.workflows.shared.segmentation.SegmentationConfigs
import expo.modules.nanort.module.workflows.shared.segmentation.SegmentationProcessor
import expo.modules.nanort.module.workflows.shared.segmentation.SegmentationWorkspace
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
