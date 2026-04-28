package expo.modules.nanort.module.opencv

import android.graphics.Bitmap


/**
 * Executes [block] and ensures the Bitmap is always recycled, even on exceptions.
 * WARNING: Do not return this Bitmap from the block or store it in fields.
 */
inline fun <T> Bitmap.use(block: (Bitmap) -> T): T {
  return try {
    block(this)
  } finally {
    safeRecycle()
  }
}

/**
 * Safe nullable variant of [use]. Returns null if the bitmap is null.
 */
inline fun <T> Bitmap?.useOrNull(block: (Bitmap) -> T): T? {
  return this?.use(block)
}

/**
 * Safely recycles the bitmap, ignoring any exceptions.
 */
fun Bitmap.safeRecycle() {
  runCatching {
    if (!isRecycled) recycle()
  }
}

/**
 * Executes [block] and ensures all bitmaps in the list are recycled afterward.
 */
inline fun <T> List<Bitmap>.useAll(block: (List<Bitmap>) -> T): T {
  return try {
    block(this)
  } finally {
    forEach { it.safeRecycle() }
  }
}

/**
 * Executes [block] and recycles all bitmaps from the pairs.
 * Useful for collections like `List<Pair<Bitmap, List<Float>>>`.
 */
inline fun <P, R> List<Pair<Bitmap, P>>.useBitmaps(block: (List<Pair<Bitmap, P>>) -> R): R {
  return try {
    block(this)
  } finally {
    forEach { (bitmap, _) -> bitmap.safeRecycle() }
  }
}

/**
 * Loads a bitmap and automatically manages its lifecycle within the block scope.
 */
inline fun <R> withBitmap(
  imageUri: String,
  loader: (String) -> Bitmap,
  block: (Bitmap) -> R
): R = loader(imageUri).use(block)