package expo.modules.nanort.module.workflows.shared.segmentation

import expo.modules.nanort.core.ModuleLogger
import expo.modules.nanort.core.logW
import expo.modules.nanort.module.workflows.shared.errors.SingleSegmentRequiredException
import expo.modules.nanort.module.workflows.shared.errors.SingleSegmentRequiredException.Reason

object SegmentValidators {
  private val TAG = ModuleLogger.createTag("SegmentValidators")

  /**
   * Exige exactamente 1 segmento. Devuelve ese segmento o lanza SingleSegmentRequiredException.
   * @param entity Nombre lógico del “objeto” esperado (ej. "aro", "raíz", etc.) — solo para mensajes.
   */
  fun <T> requireSingleSegment(segments: List<T>, entity: String = "segmento"): T {
    return when (segments.size) {
      1 -> segments.first()
      0 -> {
        logW(TAG) { "single_segment_invalid expected=1 actual=0 entity=$entity" }
        throw SingleSegmentRequiredException(
          reason = Reason.NO_SEGMENT,
          segmentsCount = 0,
          message = "No se detectó $entity. Por favor vuelve a tomar la foto asegurando buen enfoque e iluminación."
        )
      }
      else -> {
        logW(TAG) { "single_segment_invalid expected=1 actual=${segments.size} entity=$entity" }
        throw SingleSegmentRequiredException(
          reason = Reason.MULTIPLE_SEGMENTS,
          segmentsCount = segments.size,
          message = "Se detectaron múltiples $entity. Por favor vuelve a tomar la foto con un solo objetivo en cuadro."
        )
      }
    }
  }
}