package com.nanort.module.interpreter

import android.os.Looper
import com.nanort.BuildConfig
import com.nanort.core.ModuleLogger
import com.nanort.core.logW
import com.nanort.module.interpreter.internal.InterpreterActor
import kotlinx.coroutines.runBlocking

object ModelManager {

  sealed class ManagerException(message: String, cause: Throwable? = null) : RuntimeException(message, cause)
  class ModelLoadException(message: String, cause: Throwable? = null) : ManagerException(message, cause)
  class DelegateException(message: String, cause: Throwable? = null) : ManagerException(message, cause)
  class IoException(message: String, cause: Throwable? = null) : ManagerException(message, cause)

  private val TAG = ModuleLogger.createTag("ModelManager")

  private val actorLazy = lazy { InterpreterActor() }

  @Volatile
  internal var actorOverride: InterpreterActor? = null

  private val actor: InterpreterActor
    get() = actorOverride ?: actorLazy.value

  internal fun installActorForTests(actor: InterpreterActor) {
    check(BuildConfig.DEBUG) { "installActorForTests is debug-only" }
    actorOverride = actor
  }

  internal fun clearActorForTests() {
    check(BuildConfig.DEBUG) { "clearActorForTests is debug-only" }
    actorOverride = null
  }

  internal fun actorDebugSnapshotForSoak(): InterpreterActor.DebugSnapshot {
    return actor.debugSnapshotForSoak()
  }

  suspend fun <T> withInterpreter(modelId: ModelId, block: suspend (InterpreterSession) -> T): T {
    return actor.run(modelId, block)
  }

  suspend fun releaseCurrentSession() {
    actor.release()
  }

  suspend fun shutdown() {
    actor.shutdown()
  }

  fun shutdownBlocking() {
    if (Looper.getMainLooper().thread === Thread.currentThread()) {
      val msg = "shutdownBlocking_on_main_thread_forbidden"
      logW(TAG) { msg }
      throw IllegalStateException(msg)
    }
    runBlocking { shutdown() }
  }
}
