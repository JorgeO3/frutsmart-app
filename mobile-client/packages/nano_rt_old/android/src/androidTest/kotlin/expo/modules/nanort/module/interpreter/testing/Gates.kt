package expo.modules.nanort.module.interpreter.testing

import kotlinx.coroutines.CompletableDeferred

class SuspendGate {
  private val deferred = CompletableDeferred<Unit>()

  suspend fun await(timeoutMs: Long) {
    withTimeoutOrFail(timeoutMs) { deferred.await() }
  }

  fun open() {
    if (!deferred.isCompleted) deferred.complete(Unit)
  }
}
