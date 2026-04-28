package com.nanort.module.workflows.field.pipelines

import org.opencv.core.Mat
import org.opencv.core.Size
import org.opencv.android.Utils

import com.nanort.core.ModuleLogger
import com.nanort.core.logD
import com.nanort.core.logE
import com.nanort.core.logI
import com.nanort.module.workflows.shared.base.AbstractSegmentationPipeline
import com.nanort.module.interpreter.ModelId
import com.nanort.module.workflows.field.workflows.FieldInitialInput
import com.nanort.module.workflows.field.workflows.FieldSegmentationResult
import com.nanort.module.workflows.shared.segmentation.Segment
import com.nanort.module.workflows.shared.segmentation.SegmentationConfig
import com.nanort.module.workflows.shared.segmentation.SegmentationConfigs
import com.nanort.module.workflows.shared.segmentation.SegmentationWorkspace
import com.nanort.module.workflows.shared.segmentation.SegmentationProcessor
import com.nanort.module.workflows.shared.segmentation.SegmentValidators.requireSingleSegment

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
