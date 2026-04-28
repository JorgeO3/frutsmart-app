package expo.modules.nanort.module.interpreter.safety

import androidx.test.ext.junit.runners.AndroidJUnit4
import expo.modules.nanort.module.interpreter.testing.NanoRtTestRule
import expo.modules.nanort.module.interpreter.testing.TestModels
import expo.modules.nanort.module.interpreter.testing.TestTimeouts
import expo.modules.nanort.module.interpreter.testing.withTimeoutOrFail
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.nio.ByteBuffer
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference

@RunWith(AndroidJUnit4::class)
class ForeignThreadBufferUseAndroidTest {

  @get:Rule val rt = NanoRtTestRule(gpuEnabled = false)

  @Test
  fun foreign_thread_writes_on_escaped_buffer_must_not_affect_active_lease() {
    runBlocking {
      val h = rt.harness
      val escaped = AtomicReference<ByteBuffer?>(null)

      withTimeoutOrFail(TestTimeouts.MEDIUM_MS) {
        h.withInterpreter(TestModels.IC) { session ->
          escaped.set(session.getInputBuffer())
        }
      }

      withTimeoutOrFail(TestTimeouts.MEDIUM_MS) {
        h.withInterpreter(TestModels.IC) { session ->
          val current = session.getInputBuffer()
          current.putFloat(0, 5f)

          val pool = Executors.newSingleThreadExecutor()
          try {
            pool.submit { escaped.get()!!.putFloat(0, 123f) }.get(2, TimeUnit.SECONDS)
          } finally {
            pool.shutdownNow()
          }

          assertEquals(
            "Off-thread escaped write tainted active lease input",
            5f,
            current.getFloat(0),
            0.0001f
          )
        }
      }
    }
  }
}
