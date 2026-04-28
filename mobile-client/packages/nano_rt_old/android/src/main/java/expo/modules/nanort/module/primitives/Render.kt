package expo.modules.nanort.module.primitives

import android.graphics.Bitmap

/**
 * Contrato para convertir el resultado de un pipeline ('T') en un Bitmap.
 * Esto desacopla la lógica de procesamiento de la de presentación (UI).
 *
 * CORRECCIÓN: El Bitmap original ahora se pasa como un parámetro explícito
 * para evitar el uso de 'context receivers' obsoletos.
 */
fun interface Render<T : Any> {
  fun T.toBitmap(originalBitmap: Bitmap): Bitmap
}

/**
 * Un adaptador que envuelve un pipeline de datos puros (Bitmap -> O) y un Renderer
 * para presentar una fachada simple (Bitmap -> Bitmap) para casos de uso de UI o demos.
 */
class Standalone<O : Any>(
  private val pipeline: Pipeline<Bitmap, O>,
  private val renderer: Render<O>
) : Pipeline<Bitmap, Bitmap> {

  override suspend fun execute(input: Bitmap): Bitmap {
    // 1. Ejecuta el pipeline para obtener el resultado de datos estructurados.
    val result = pipeline.execute(input)

    // 2. Usa el renderer para convertir el resultado en un Bitmap final.
    // Se llama a la nueva firma, pasando el 'input' (Bitmap original) como parámetro.
    return with(renderer) { result.toBitmap(input) }
  }
}