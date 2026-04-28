package expo.modules.nanort.module.opencv

import android.graphics.Rect as AndroidRect

import org.opencv.core.CvType
import org.opencv.core.Mat
import org.opencv.core.Rect


/**
 * Ejecuta un bloque de código con un Mat y garantiza que .release() se llame al final.
 * Similar al 'use' estándar para objetos Closeable.
 */
inline fun <T> Mat.use(block: (Mat) -> T): T {
  try {
    return block(this)
  } finally {
    this.release()
  }
}

fun Rect.clamp(maxCols: Int, maxRows: Int): Rect? {
  val x1 = this.x.coerceIn(0, maxCols - 1)
  val y1 = this.y.coerceIn(0, maxRows - 1)
  val x2 = (this.x + this.width).coerceIn(x1, maxCols)
  val y2 = (this.y + this.height).coerceIn(y1, maxRows)
  val w = x2 - x1
  val h = y2 - y1
  return if (w == 0 || h == 0) null else Rect(x1, y1, w, h)
}

fun Mat.describe(name: String): String {
  return "$name: size=${this.rows()}x${this.cols()}, type=${this.type()} (${CvType.typeToString(this.type())}), channels=${this.channels()}, empty=${this.empty()}"
}

fun Rect.toAndroidRect(): AndroidRect {
  return AndroidRect(
    this.x,
    this.y,
    this.x + this.width,
    this.y + this.height
  )
}
