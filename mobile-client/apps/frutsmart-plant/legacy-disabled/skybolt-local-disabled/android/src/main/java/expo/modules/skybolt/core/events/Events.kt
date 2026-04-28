package expo.modules.skybolt.core.events

import expo.modules.skybolt.core.util.logger
import java.util.concurrent.atomic.AtomicReference

/**
 * Fachada global minimalista para emitir eventos sin atar el core a ninguna lib externa.
 * Puedes registrar el sink en Application.onCreate() y cambiarlo en runtime si quieres.
 */
object Events {
    private val log by logger()
    private val Noop = NativeEventSink { _, _ -> }
    private val sinkRef = AtomicReference(Noop)

    fun setSink(sink: NativeEventSink) {
        sinkRef.set(sink)
        log.d { "Event sink registered: ${sink.javaClass.simpleName}" }
    }

    fun clear() {
        sinkRef.set(Noop)
        log.d { "Event sink cleared" }
    }

    fun emit(event: SkyboltEvent) {
        try {
            val sink = sinkRef.get()
            if (sink === Noop) {
                log.v { "Event dropped (no sink): ${event.type.wireName}" }
                return
            }
            log.d { "Emitting event: ${event.type.wireName}" }
            sink.emit(event.type.wireName, event.payload())
        } catch (t: Throwable) {
            log.e(t) { "Failed to emit event: ${event.type.wireName}" }
        }
    }
}