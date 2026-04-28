package expo.modules.nanort.module.interpreter.safety

import androidx.test.ext.junit.runners.AndroidJUnit4
import expo.modules.nanort.module.interpreter.testing.NanoRtTestRule
import expo.modules.nanort.module.interpreter.testing.TestModels
import expo.modules.nanort.module.interpreter.testing.TestTimeouts
import expo.modules.nanort.module.interpreter.testing.withTimeoutOrFail
import java.nio.ByteBuffer
import java.util.Arrays
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class OutputBufferLeaseEscapeAndroidTest {

  @get:Rule val rt = NanoRtTestRule(gpuEnabled = false)

  @Test
  fun escaped_output_buffer_must_not_mutate_after_later_inference() {
    runBlocking {
      val h = rt.harness

      lateinit var escaped: ByteBuffer
      lateinit var before: ByteArray

      withTimeoutOrFail(TestTimeouts.MEDIUM_MS) {
        h.withInterpreter(TestModels.IC) { session ->
          session.runInference()
          escaped = session.getOutputBuffers().getValue(0)
          before = snapshotBytes(escaped)
        }
      }

      withTimeoutOrFail(TestTimeouts.MEDIUM_MS) {
        h.withInterpreter(TestModels.IC) { session ->
          session.runInference()
          session.getOutputBuffers().getValue(0)
        }
      }

      val after = snapshotBytes(escaped)
      assertTrue("Escaped output should be read-only", escaped.isReadOnly)
      assertTrue(
        "Escaped output changed after later inference (possible live alias leak)",
        Arrays.equals(before, after)
      )
    }
  }

  private fun snapshotBytes(buffer: ByteBuffer): ByteArray {
    val dup = buffer.asReadOnlyBuffer()
    dup.rewind()
    val out = ByteArray(dup.remaining())
    dup.get(out)
    return out
  }
}
