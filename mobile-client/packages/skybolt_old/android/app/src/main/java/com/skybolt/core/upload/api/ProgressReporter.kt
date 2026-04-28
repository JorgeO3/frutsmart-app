package com.skybolt.core.upload.api


/**
 * Callback de progreso/estado unificado.
 * Tu Worker puede adaptarlo para emitir eventos a JS.
 */
interface ProgressReporter {

    /** Avance a nivel de *item*. */
    fun onItemProgress(p: ItemProgress) {}

    /** Fin OK de item. */
    fun onItemCompleted(itemId: String) {}

    /** Fin con error de item. */
    fun onItemFailed(itemId: String, error: Err.UploadError) {}

    /** Avance a nivel de *sesión*. */
    fun onSessionProgress(p: SessionProgress) {}

    /** Mensajes debug/trace opcionales. */
    fun onLog(message: String) {}
}
