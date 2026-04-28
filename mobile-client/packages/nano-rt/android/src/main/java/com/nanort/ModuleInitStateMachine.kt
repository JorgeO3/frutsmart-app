package com.nanort

import kotlinx.coroutines.CompletableDeferred

internal class ModuleInitStateMachine {

  private enum class State {
    NEW,
    INITIALIZING,
    READY,
    FAILED,
  }

  private var state: State = State.NEW
  private var readyDeferred: CompletableDeferred<Unit> = CompletableDeferred()

  fun isReady(): Boolean = synchronized(this) { state == State.READY }

  fun isFailed(): Boolean = synchronized(this) { state == State.FAILED }

  fun markInitializingIfIdle(): Boolean = synchronized(this) {
    return if (state == State.NEW) {
      state = State.INITIALIZING
      true
    } else {
      false
    }
  }

  fun markReady() {
    val deferredToComplete = synchronized(this) {
      state = State.READY
      readyDeferred
    }
    if (!deferredToComplete.isCompleted) {
      deferredToComplete.complete(Unit)
    }
  }

  fun markFailure(error: Throwable) {
    val deferredToComplete = synchronized(this) {
      state = State.FAILED
      readyDeferred
    }
    if (!deferredToComplete.isCompleted) {
      deferredToComplete.completeExceptionally(error)
    }
  }

  fun resetForRetryIfFailed(): Boolean = synchronized(this) {
    return if (state == State.FAILED) {
      state = State.NEW
      readyDeferred = CompletableDeferred()
      true
    } else {
      false
    }
  }

  suspend fun awaitReady() {
    val deferred = synchronized(this) { readyDeferred }
    deferred.await()
  }
}
