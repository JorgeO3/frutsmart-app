package expo.modules.nanort.module.interpreter.internal

import expo.modules.nanort.BuildConfig
import expo.modules.nanort.module.interpreter.ModelId
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.withTimeoutOrNull
import java.util.concurrent.atomic.AtomicLong
import java.util.concurrent.atomic.AtomicReference

internal object ModelManagerDebugHooks {

  enum class Point {
    AFTER_DEQUEUE,
    AFTER_RELEASE_BEFORE_DELEGATE,
    AFTER_ENSURE_BEFORE_RUN,
  }

  data class Barrier(
    val point: Point,
    val model: ModelId,
    val timeoutMs: Long = 5_000L,
    val arrived: CompletableDeferred<Unit> = CompletableDeferred(),
    val proceed: CompletableDeferred<Unit> = CompletableDeferred(),
  )

  private val barrierRef = AtomicReference<Barrier?>(null)
  private val startupFailureRef = AtomicReference<Throwable?>(null)
  private val startupDelayMsRef = AtomicLong(0L)

  @Volatile
  var enabled: Boolean = false
    private set

  fun installBarrier(point: Point, model: ModelId, timeoutMs: Long = 5_000L): Barrier {
    barrierRef.getAndSet(null)?.let { old ->
      if (!old.proceed.isCompleted) old.proceed.complete(Unit)
    }

    val b = Barrier(point = point, model = model, timeoutMs = timeoutMs)
    enabled = true
    barrierRef.set(b)
    return b
  }

  fun clear() {
    barrierRef.getAndSet(null)?.let { b ->
      if (!b.proceed.isCompleted) b.proceed.complete(Unit)
    }
    enabled = false
    startupFailureRef.set(null)
    startupDelayMsRef.set(0L)
  }

  fun currentBarrier(): Barrier? = barrierRef.get()

  fun failStartupOnce(cause: Throwable) {
    startupFailureRef.set(cause)
  }

  fun startupDelayOnce(delayMs: Long) {
    startupDelayMsRef.set(delayMs.coerceAtLeast(0L))
  }

  fun consumeStartupFailure(): Throwable? = startupFailureRef.getAndSet(null)

  fun consumeStartupDelayMs(): Long = startupDelayMsRef.getAndSet(0L)

  suspend fun hit(point: Point, model: ModelId) {
    if (!BuildConfig.DEBUG) return
    if (!enabled) return

    val b = barrierRef.get() ?: return
    if (b.point != point || b.model != model) return

    if (!b.arrived.isCompleted) b.arrived.complete(Unit)

    val ok = withTimeoutOrNull(b.timeoutMs) { b.proceed.await() } != null
    if (!ok) {
      barrierRef.compareAndSet(b, null)
      enabled = false
    }
  }
}
