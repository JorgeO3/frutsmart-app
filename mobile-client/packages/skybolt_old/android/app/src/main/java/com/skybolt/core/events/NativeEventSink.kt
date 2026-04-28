package com.skybolt.core.events

/** Sumidero genérico de eventos app -> capa superior (UI/JS/telemetría/etc). */
fun interface NativeEventSink {
  /**
   * Emite un evento tipado con un payload arbitrario (solo tipos básicos/Map anidados).
   * Las implementaciones deben ser thread-safe y no lanzar excepciones.
   */
  fun emit(type: String, payload: Map<String, Any?>)
}