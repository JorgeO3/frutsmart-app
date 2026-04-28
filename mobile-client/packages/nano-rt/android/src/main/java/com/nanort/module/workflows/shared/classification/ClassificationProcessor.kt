package com.nanort.module.workflows.shared.classification

import android.graphics.Bitmap
import org.opencv.android.Utils
import org.opencv.core.CvException
import org.opencv.core.CvType
import org.opencv.core.Mat
import org.opencv.core.Size
import org.opencv.imgproc.Imgproc
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.FloatBuffer
import java.util.Locale
import kotlin.math.max

import com.nanort.core.ModuleLogger
import com.nanort.core.logD
import com.nanort.core.logE
import com.nanort.core.logI
import com.nanort.core.logW

/**
 * Procesador de clasificación con validación defensiva, manejo de errores y logging estructurado.
 *
 * Requisitos:
 * - `ClassificationWorkspace` debe existir y sus Mats serán reutilizados.
 * - El buffer de entrada debe tener capacidad EXACTA para size×size×3 floats.
 */
object ClassificationProcessor {

  // ===================== Excepciones específicas =====================
  sealed class ClassificationProcessorException(message: String, cause: Throwable? = null) :
    RuntimeException(message, cause)

  class PreprocessException(message: String, cause: Throwable? = null) :
    ClassificationProcessorException(message, cause)

  class PostprocessException(message: String, cause: Throwable? = null) :
    ClassificationProcessorException(message, cause)

  // ===================== Logging / Utils =====================
  private val TAG = ModuleLogger.createTag("ClsProcessor")

  private fun kv(vararg pairs: Pair<String, Any?>) =
    pairs.joinToString(" ") { (k, v) -> "$k=$v" }

  // ================================================================================================
  // PRE-PROCESADO
  // ================================================================================================

  /**
   * Prepara un bitmap para la inferencia de clasificación.
   * Pasos: Bitmap→RGBA→RGB, resize a size×size, normaliza a [0,1] en float32 y vuelca al buffer.
   *
   * Validaciones:
   * - `bitmap` no reciclado, `size > 0`
   * - Capacidad de `inputBuffer` == size×size×3 floats
   * - Manejo de posibles `CvException` de OpenCV (resize/color).
   */
  fun preprocess(
    bitmap: Bitmap,
    inputBuffer: ByteBuffer,
    ws: ClassificationWorkspace,
    size: Int
  ) {
    require(size > 0) { "cls_pre_size_invalid size=$size" }
    require(!bitmap.isRecycled) { "cls_pre_bitmap_recycled" }

    // Verifica capacidad del buffer (floats)
    val expectedFloats = size * size * 3
    val capacityFloats = inputBuffer.capacity() / 4
    require(capacityFloats == expectedFloats) {
      "cls_pre_buffer_size_mismatch " + kv("expectedFloats" to expectedFloats, "bufferFloats" to capacityFloats)
    }

    val t0 = System.nanoTime()

    try {
      // Cargar a RGBA y convertir a RGB (1 copia de píxeles)
      ws.rgba.create(bitmap.height.coerceAtLeast(1), bitmap.width.coerceAtLeast(1), CvType.CV_8UC4)
      Utils.bitmapToMat(bitmap, ws.rgba)

      Imgproc.cvtColor(ws.rgba, ws.rgb, Imgproc.COLOR_RGBA2RGB)

      // Resize solo si hace falta
      if (ws.rgb.width() != size || ws.rgb.height() != size) {
        val interp = if (size < max(ws.rgb.width(), ws.rgb.height())) Imgproc.INTER_AREA else Imgproc.INTER_LINEAR
        safeResize(ws.rgb, ws.rgb, Size(size.toDouble(), size.toDouble()), interp)
      }

      // Normalización a float32 [0,1]
      ws.rgb.convertTo(ws.rgbF32, CvType.CV_32F, 1.0 / 255.0)

      if (ws.floatArray?.size != expectedFloats) {
        ws.floatArray = FloatArray(expectedFloats)
      }
      val arr = ws.floatArray!!

      ws.rgbF32.get(0, 0, arr)

      // Vuelca al buffer (asegura orden y posición)
      inputBuffer.order(ByteOrder.LITTLE_ENDIAN)
      inputBuffer.rewind()
      inputBuffer.asFloatBuffer().put(arr)
      inputBuffer.rewind()

      val ms = (System.nanoTime() - t0) / 1_000_000.0
      logD(TAG) { "cls_pre_ok " + kv("size" to size, "ms" to String.format(Locale.US, "%.3f", ms)) }
    } catch (e: CvException) {
      logE(TAG, e) { "cls_pre_cvexception" }
      throw PreprocessException("Error OpenCV en preprocesado (color/resize).", e)
    } catch (t: Throwable) {
      logE(TAG, t) { "cls_pre_fail" }
      throw PreprocessException("Fallo en preprocesado de clasificación.", t)
    }
  }

  private fun safeResize(src: Mat, dst: Mat, newSize: Size, interp: Int) {
    require(!src.empty()) { "cls_resize_src_empty" }
    require(newSize.width > 0 && newSize.height > 0) {
      "cls_resize_invalid_size " + kv("w" to newSize.width, "h" to newSize.height)
    }
    Imgproc.resize(src, dst, newSize, 0.0, 0.0, interp) // puede lanzar CvException
  }

  /**
   * Lee output[0] del intérprete (ya *después* de runInference) y devuelve el vector de confidencias.
   * También registra tiempos por imagen (imgMs, infMs) y el número de clases.
   *
   * @param outputs Array de buffers de salida del intérprete (el índice 0 debe existir).
   * @param idx     Índice de la imagen procesada (solo para logging).
   * @param imgStartNs timestamp (ns) cuando se empezó a procesar esta imagen.
   * @param infStartNs timestamp (ns) justo antes de invocar runInference().
   */
  fun extractConfidences(
    outputs: Map<Int, ByteBuffer>,
    idx: Int,
    imgStartNs: Long,
    infStartNs: Long
  ): FloatArray {
    val out0 = outputs[0] ?: throw IllegalStateException("output_buffer_missing index=0")
    out0.rewind()
    val fb: FloatBuffer = out0.asFloatBuffer()
    val confidences = FloatArray(fb.remaining())
    fb.get(confidences)

    val imgMs = (System.nanoTime() - imgStartNs) / 1_000_000.0
    val infMs = (System.nanoTime() - infStartNs) / 1_000_000.0
    logD(TAG) {
      "img_ok " + kv(
        "idx" to idx,
        "imgMs" to String.format(Locale.US, "%.3f", imgMs),
        "infMs" to String.format(Locale.US, "%.3f", infMs),
        "classes" to confidences.size
      )
    }
    return confidences
  }
}
