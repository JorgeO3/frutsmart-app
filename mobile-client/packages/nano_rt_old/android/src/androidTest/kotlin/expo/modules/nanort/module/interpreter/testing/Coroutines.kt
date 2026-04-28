package expo.modules.nanort.module.interpreter.testing

import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.withTimeout

suspend fun <T> withTimeoutOrFail(timeoutMs: Long, block: suspend () -> T): T {
  return try {
    withTimeout(timeoutMs) { block() }
  } catch (e: TimeoutCancellationException) {
    throw AssertionError("Timeout de ${timeoutMs}ms (posible deadlock/jank) en test.", e)
  }
}
