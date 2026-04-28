package expo.modules.nanort.module.interpreter.actor

import androidx.test.ext.junit.runners.AndroidJUnit4
import expo.modules.nanort.module.interpreter.ModelId
import expo.modules.nanort.module.interpreter.testing.NanoRtTestRule
import expo.modules.nanort.module.interpreter.testing.TestTimeouts
import expo.modules.nanort.module.interpreter.testing.withTimeoutOrFail
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class RecoverableFatalRestartAndroidTest {

  @get:Rule val rt = NanoRtTestRule(gpuEnabled = false)

  @Test
  fun non_error_failure_inside_run_must_not_poison_actor() {
    runBlocking {
      val h = rt.harness

      val first = runCatching {
        withTimeoutOrFail(TestTimeouts.MEDIUM_MS) {
          h.withInterpreter(ModelId.IC) {
            throw IllegalStateException("recoverable_borrower_failure")
          }
        }
      }
      assertTrue("First run should fail", first.isFailure)

      val second = runCatching {
        withTimeoutOrFail(TestTimeouts.MEDIUM_MS) {
          h.withInterpreter(ModelId.IC) { }
        }
      }
      assertTrue("Actor should remain usable after recoverable failure", second.isSuccess)
    }
  }
}
