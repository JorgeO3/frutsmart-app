package expo.modules.nanort.module.workflows.field.pipelines

import org.opencv.core.Mat
import org.opencv.core.Size
import org.opencv.android.Utils

import expo.modules.nanort.core.ModuleLogger
import expo.modules.nanort.core.logD
import expo.modules.nanort.core.logE
import expo.modules.nanort.core.logI
import expo.modules.nanort.module.workflows.shared.base.AbstractSegmentationPipeline
import expo.modules.nanort.module.interpreter.ModelId
import expo.modules.nanort.module.workflows.field.workflows.FieldInitialInput
import expo.modules.nanort.module.workflows.field.workflows.FieldSegmentationResult
import expo.modules.nanort.module.workflows.shared.segmentation.Segment
import expo.modules.nanort.module.workflows.shared.segmentation.SegmentationConfig
import expo.modules.nanort.module.workflows.shared.segmentation.SegmentationConfigs
import expo.modules.nanort.module.workflows.shared.segmentation.SegmentationWorkspace
import expo.modules.nanort.module.workflows.shared.segmentation.SegmentationProcessor
import expo.modules.nanort.module.workflows.shared.segmentation.SegmentValidators.requireSingleSegment

/**
 * Pipeline de segmentación para "Field".
 * Requiere exactamente 1 segmento válido.
 * Errores de “cantidad de segmentos” se manejan con la excepción genérica en SegmentValidators
 * y se envuelven en el borde Expo (CodedException) según el enfoque 2.
 */
class FieldSegmentationPipeline :
  AbstractSegmentationPipeline<FieldInitialInput, FieldSegmentationResult>() {

  private val TAG = ModuleLogger.createTag("FieldSegPipe")

  override fun getModelId(): ModelId = ModelId.SS // Single Segmentation
  override fun getConfig(): SegmentationConfig = SegmentationConfigs.SINGLE

  private fun kv(vararg pairs: Pair<String, Any?>) =
    pairs.joinToString(" ") { (k, v) -> "$k=$v" }

  override fun getBitmap(input: FieldInitialInput): Mat {
    require(!input.bitmap.isRecycled) { "input_bitmap_recycled" }
    return Mat().apply { Utils.bitmapToMat(input.bitmap, this) }
  }

  override fun buildOutput(
    input: FieldInitialInput,
    segments: List<Segment>,
    ws: SegmentationWorkspace
  ): FieldSegmentationResult {
    // Debe existir un único segmento; si no, se lanza SingleSegmentRequiredException
    val single = requireSingleSegment(segments, entity = "segmento")

    logI(TAG) { "field_extraction_begin " + kv("segments" to segments.size) }

    val segmentedBitmaps = try {
      SegmentationProcessor.extractCroppedSegments(
        segments = listOf(single),
        sourceBitmap = input.bitmap,
        targetSize = Size(224.0, 224.0),
        ws = ws
      )
    } catch (t: Throwable) {
      // Excepciones inesperadas del procesador (OpenCV, tamaños, etc.) — no recuperables en UI
      logE(TAG, t) { "field_extraction_fail" }
      throw RuntimeException("Fallo extrayendo el recorte del segmento.", t)
    }

    logD(TAG) { "field_extraction_ok " + kv("count" to segmentedBitmaps.size) }

    return FieldSegmentationResult(
      sourceBitmap = input.bitmap,
      segmentedBitmaps = segmentedBitmaps
    )
  }
}
