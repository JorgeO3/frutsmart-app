package com.nanort.module.io

import android.content.Context
import android.graphics.Bitmap
import android.graphics.ImageDecoder
import android.graphics.ColorSpace
import android.net.Uri
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

class ImageRepositoryImpl(private val context: Context) : ImageRepository {
  /**
   * Punto de entrada principal. Delega a la función correcta según la versión de Android.
   */
  override suspend fun getImageFromUri(uri: Uri): Bitmap = withContext(Dispatchers.IO) {
    val bmp = SafeImageLoader.decodeScaled(
      context = context,
      uri = uri,
      params = SafeImageLoader.Params(
        maxLongEdge = 2048,   // ajusta si quieres 1600–2560
        maxBitmapMb = 24
      )
    )
    bmp // listo para pasar a OpenCV sin copias adicionales
  }
}

/**
 * Carga una imagen *sin* inflarla a tamaño completo.
 * - Aplica EXIF automáticamente (ImageDecoder).
 * - Decodifica directamente en memoria de software (ARGB_8888) compatible con OpenCV.
 * - Ajusta el tamaño objetivo para evitar picos de memoria.
 */
object SafeImageLoader {

  data class Params(
    val maxLongEdge: Int = 2048,        // 2048 px suele ser un gran “sweet spot”
    val maxBitmapMb: Int = 24,          // presupuesto de RAM para el bitmap resultante
    val forceSRGB: Boolean = true       // color estable para ML
  )

  suspend fun decodeScaled(
    context: Context,
    uri: Uri,
    params: Params = Params()
  ): Bitmap = withContext(Dispatchers.IO) {
    val source = ImageDecoder.createSource(context.contentResolver, uri)

    ImageDecoder.decodeBitmap(source) { decoder, info, _ ->
      // 1) Siempre software: evita HARDWARE para poder leer píxeles y pasar a Mat sin copias extra.
      decoder.allocator = ImageDecoder.ALLOCATOR_SOFTWARE
      decoder.isMutableRequired = false

      // 2) Color estable
      if (params.forceSRGB) {
        decoder.setTargetColorSpace(ColorSpace.get(ColorSpace.Named.SRGB))
      }

      // 3) Elegir tamaño objetivo sin inflar en RAM
      val srcW = info.size.width
      val srcH = info.size.height
      val (tW, tH) = pickTargetSize(srcW, srcH, params)
      decoder.setTargetSize(tW, tH)

      // 4) (Opcional) Política de memoria agresiva si vas corto:
      // decoder.setMemorySizePolicy(ImageDecoder.MEMORY_POLICY_LOW_RAM)
    }.also { bmp ->
      if (bmp.config == Bitmap.Config.ARGB_8888) bmp
      else bmp.copy(Bitmap.Config.ARGB_8888, false)
    }
  }

  private fun pickTargetSize(
    srcW: Int,
    srcH: Int,
    params: Params,
  ): Pair<Int, Int> {
    val (maxW, maxH) = fitInsideLongEdge(srcW, srcH, params.maxLongEdge)

    // Garantiza que el bitmap quepa en el presupuesto de RAM
    val bytesPerPixel = 4 // ARGB_8888
    val maxBytes = params.maxBitmapMb * 1024 * 1024L

    var tW = maxW
    var tH = maxH
    val estBytes = tW.toLong() * tH * bytesPerPixel
    if (estBytes > maxBytes) {
      val scale = kotlin.math.sqrt(maxBytes.toDouble() / estBytes.toDouble())
      tW = max(1, (tW * scale).roundToInt())
      tH = max(1, (tH * scale).roundToInt())
    }

    // Nunca pidas más grande que el original
    tW = min(tW, srcW)
    tH = min(tH, srcH)
    return tW to tH
  }

  private fun fitInsideLongEdge(w: Int, h: Int, maxLong: Int): Pair<Int, Int> {
    if (w == 0 || h == 0) return 1 to 1
    return if (w >= h) {
      val scale = maxLong.toDouble() / w.toDouble()
      max(1, (w * scale).roundToInt()) to max(1, (h * scale).roundToInt())
    } else {
      val scale = maxLong.toDouble() / h.toDouble()
      max(1, (w * scale).roundToInt()) to max(1, (h * scale).roundToInt())
    }
  }
}