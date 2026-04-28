package com.nanort.module.interpreter.internal

import com.nanort.module.interpreter.InterpreterSession
import com.nanort.module.interpreter.ModelId
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Job

internal enum class InterpreterState {
  UNLOADED,
  LOADING,
  READY,
  RUNNING,
  RELEASING,
}

internal sealed interface Msg {
  val enqueuedAtNs: Long

  data class Run(
    val modelId: ModelId,
    val block: suspend (InterpreterSession) -> Any?,
    val reply: CompletableDeferred<Result<Any?>>,
    override val enqueuedAtNs: Long,
    val callerJob: Job?,
  ) : Msg

  data class Release(
    val reply: CompletableDeferred<Result<Unit>>,
    override val enqueuedAtNs: Long,
  ) : Msg

  data class Shutdown(
    val reply: CompletableDeferred<Result<Unit>>,
    override val enqueuedAtNs: Long,
  ) : Msg
}
