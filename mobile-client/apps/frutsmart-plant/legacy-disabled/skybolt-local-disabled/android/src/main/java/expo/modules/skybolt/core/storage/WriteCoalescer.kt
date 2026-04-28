package expo.modules.skybolt.core.storage

import kotlinx.coroutines.*
import kotlinx.coroutines.channels.BufferOverflow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import android.os.SystemClock
import expo.modules.skybolt.core.util.logger
import kotlinx.coroutines.launch
import kotlin.math.min
import kotlin.ranges.coerceAtLeast
import kotlin.time.Duration.Companion.milliseconds

/**
 * Coalescer de escrituras:
 * - Abre una ventana mínima [minDelayMs] desde el PRIMER trigger.
 * - Si siguen llegando triggers, extiende la ventana hasta [maxDelayMs].
 * - Hace un único flush (ejecuta la última acción) cuando se cumple la ventana o llega el tope.
 *
 * Cambios clave:
 * - Ventana correcta: programa el flush en min(firstAt+maxDelay, now+minDelay).
 * - Backpressure real (emit suspensivo). También se expone trySubmit() no bloqueante.
 * - Reloj monotónico (elapsedRealtime) para evitar skew por cambios de hora.
 * - Sin condiciones de carrera: estado protegido con Mutex y "schedule tokens".
 */
class WriteCoalescer(
    private val scope: CoroutineScope,
    private val minDelayMs: Long = 120L,
    private val maxDelayMs: Long = 500L
) {
    private val log by logger()

    init {
        require(minDelayMs >= 0L && maxDelayMs >= 0L) { "Delays must be >= 0" }
        require(maxDelayMs >= minDelayMs) { "maxDelayMs must be >= minDelayMs" }
    }

    // Buffer 0 + SUSPEND => backpressure real para submit() (emit).
    // Ofrecemos trySubmit() para escenarios donde no queremos suspender.
    private val triggers = MutableSharedFlow<suspend () -> Unit>(
        replay = 0,
        extraBufferCapacity = 0,
        onBufferOverflow = BufferOverflow.SUSPEND
    )

    private val stateMutex = Mutex()
    private var firstAtMs: Long = -1L
    private var dueAtMs: Long = -1L
    private var pending: (suspend () -> Unit)? = null
    private var scheduled: Job? = null
    private var scheduleToken: Long = 0L

    private val job: Job = scope.launch {
        // Colector único: toda la orquestación de ventana ocurre en este actor
        triggers.collect { action ->
            stateMutex.withLock {
                val now = SystemClock.elapsedRealtime()

                // nuevo pending reemplaza al anterior (queremos ejecutar "la última acción")
                pending = action
                if (firstAtMs < 0L) firstAtMs = now

                // próxima ejecución = min(firstAt + max, now + min)
                val nextDue = min(firstAtMs + maxDelayMs, now + minDelayMs)

                // reprogramar flush
                scheduled?.cancel()
                scheduleToken += 1
                val token = scheduleToken
                dueAtMs = nextDue

                scheduled = scope.launch {
                    val delayMs = (nextDue - SystemClock.elapsedRealtime()).coerceAtLeast(0L)
                    if (delayMs > 0L) delay(delayMs.milliseconds)
                    // Confirmar que no ha sido reprogramado mientras esperábamos
                    val shouldRun = stateMutex.withLock { token == scheduleToken }
                    if (shouldRun) flushOnce()
                }
            }
        }
    }

    /** Ejecuta y limpia el estado (debe llamarse con el token vigente). */
    private suspend fun flushOnce() {
        val task: (suspend () -> Unit)?
        stateMutex.withLock {
            task = pending
            pending = null
            firstAtMs = -1L
            dueAtMs = -1L
            scheduled = null
        }
        if (task != null) {
            log.v { "Flushing coalesced write" }
            withContext(Dispatchers.IO) { task.invoke() }
        }
    }

    /** Encola una acción (suspende si el coalescer está saturado). No pierde actualizaciones. */
    suspend fun submit(action: suspend () -> Unit) {
        triggers.emit(action)
    }

    /** Encola una acción sin bloquear; devuelve false si el buffer está lleno. */
    fun trySubmit(action: suspend () -> Unit): Boolean {
        return triggers.tryEmit(action)
    }
    
    /**
     * Force immediate flush of any pending writes.
     * Useful before pausing/stopping to ensure data consistency.
     */
    suspend fun flush() {
        log.d { "Forcing immediate flush" }
        val token = stateMutex.withLock { scheduled }
        token?.cancel()
        flushOnce()
    }

    /** Cancela el coalescer y cualquier flush pendiente. */
    fun close() {
        log.d { "Closing WriteCoalescer" }
        scheduled?.cancel()
        job.cancel()
    }
}

