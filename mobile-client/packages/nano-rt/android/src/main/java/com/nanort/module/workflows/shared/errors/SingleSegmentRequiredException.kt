package com.nanort.module.workflows.shared.errors

/**
 * Error de validación de captura: el workflow requiere exactamente 1 segmento.
 * - reason: NO_SEGMENT (0 encontrados) o MULTIPLE_SEGMENTS (>1 encontrados)
 * - segmentsCount: número de segmentos detectados
 */
class SingleSegmentRequiredException(
  val reason: Reason,
  val segmentsCount: Int,
  message: String
) : RuntimeException(message) {
  enum class Reason { NO_SEGMENT, MULTIPLE_SEGMENTS }
}