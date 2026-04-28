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
import java.util.concurrent.atomic.AtomicReference

@RunWith(AndroidJUnit4::class)
class InputBufferLeaseEscapeAndroidTest {

  @get:Rule val rt = NanoRtTestRule(gpuEnabled = false)

  @Test
  fun escaped_input_buffer_must_not_alias_next_lease_input() {
    runBlocking {
      val h = rt.harness
      val escaped = AtomicReference<ByteBuffer?>(null)

      withTimeoutOrFail(TestTimeouts.MEDIUM_MS) {
        h.withInterpreter(TestModels.IC) { session ->
          val buf = session.getInputBuffer()
          buf.putFloat(0, 11f)
          escaped.set(buf)
        }
      }

      withTimeoutOrFail(TestTimeouts.MEDIUM_MS) {
        h.withInterpreter(TestModels.IC) { session ->
          val current = session.getInputBuffer()
          current.putFloat(0, 7f)

          escaped.get()!!.putFloat(0, 99f)

          assertEquals(
            "Escaped buffer from old lease changed current lease input",
            7f,
            current.getFloat(0),
            0.0001f
          )
        }
      }
    }
  }
}
