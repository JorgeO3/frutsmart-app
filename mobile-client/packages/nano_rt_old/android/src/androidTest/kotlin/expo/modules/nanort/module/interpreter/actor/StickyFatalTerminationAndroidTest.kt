package expo.modules.nanort.module.interpreter.actor

import androidx.test.ext.junit.runners.AndroidJUnit4
import expo.modules.nanort.module.interpreter.ModelId
import expo.modules.nanort.module.interpreter.testing.NanoRtTestRule
import expo.modules.nanort.module.interpreter.testing.TestTimeouts
import expo.modules.nanort.module.interpreter.testing.withTimeoutOrFail
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.yield
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class StickyFatalTerminationAndroidTest {

  @get:Rule val rt = NanoRtTestRule(gpuEnabled = false)

  @Test
  fun error_inside_run_must_leave_actor_terminated_for_subsequent_calls() {
    runBlocking {
      val h = rt.harness

      val firstErr = runCatching {
        withTimeoutOrFail(TestTimeouts.MEDIUM_MS) {
          h.withInterpreter(ModelId.IC) {
            throw OutOfMemoryError("fatal_borrower_error")
          }
        }
      }.exceptionOrNull()
      assertTrue("First failure should propagate fatal Error", firstErr is OutOfMemoryError)

      withTimeoutOrFail(TestTimeouts.LONG_MS) {
        while (true) {
          val secondErr = runCatching {
            h.withInterpreter(ModelId.IC) { }
          }.exceptionOrNull()

          if (secondErr is IllegalStateException && secondErr.message?.contains("actor_terminated") == true) {
            break
          }
          yield()
        }
      }
    }
  }
}
