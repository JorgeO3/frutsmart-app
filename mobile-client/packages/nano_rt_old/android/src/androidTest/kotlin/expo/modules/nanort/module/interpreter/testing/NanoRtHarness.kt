package expo.modules.nanort.module.interpreter.testing

import android.content.Context
import expo.modules.nanort.module.interpreter.InterpreterSession
import expo.modules.nanort.module.interpreter.ModelId
import expo.modules.nanort.module.interpreter.ModelManager
import expo.modules.nanort.module.interpreter.internal.InterpreterActor
import java.io.Closeable
import java.util.concurrent.atomic.AtomicBoolean
import kotlinx.coroutines.runBlocking

class NanoRtHarness private constructor(
  private val context: Context,
) : Closeable {

  private val closed = AtomicBoolean(false)
  internal var installedTestActor: InterpreterActor? = null
    private set

  companion object {
    fun real(context: Context): NanoRtHarness = NanoRtHarness(context)
  }

  fun installIfNeeded() {
    val actor = InterpreterActor()
    installedTestActor = actor
    ModelManager.installActorForTests(actor)
  }

  suspend fun <T> withInterpreter(modelId: ModelId, block: suspend (InterpreterSession) -> T): T {
    return ModelManager.withInterpreter(modelId, block)
  }

  suspend fun releaseCurrentSession() {
    ModelManager.releaseCurrentSession()
  }

  suspend fun shutdown() {
    ModelManager.shutdown()
  }

  override fun close() {
    if (!closed.compareAndSet(false, true)) return

    runCatching { DebugControls.clearAll() }

    runCatching {
      runBlocking {
        runCatching { withTimeoutOrFail(TestTimeouts.MEDIUM_MS) { releaseCurrentSession() } }
        runCatching { withTimeoutOrFail(TestTimeouts.MEDIUM_MS) { shutdown() } }
      }
    }

    runCatching { ModelManager.clearActorForTests() }
    installedTestActor = null
  }
}
