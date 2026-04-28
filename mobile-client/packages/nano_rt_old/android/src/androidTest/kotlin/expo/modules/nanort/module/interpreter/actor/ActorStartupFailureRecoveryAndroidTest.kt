package expo.modules.nanort.module.interpreter.actor

import androidx.test.ext.junit.runners.AndroidJUnit4
import expo.modules.nanort.module.interpreter.internal.ModelManagerDebugHooks
import expo.modules.nanort.module.interpreter.testing.NanoRtTestRule
import expo.modules.nanort.module.interpreter.testing.TestModels
import expo.modules.nanort.module.interpreter.testing.TestTimeouts
import expo.modules.nanort.module.interpreter.testing.withTimeoutOrFail
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class ActorStartupFailureRecoveryAndroidTest {

  @get:Rule val rt = NanoRtTestRule(gpuEnabled = false)

  @Test
  fun startup_failure_must_not_leave_actor_stuck_in_starting_state() {
    runBlocking {
      val h = rt.harness

      ModelManagerDebugHooks.failStartupOnce(RuntimeException("synthetic_startup_failure"))

      val firstAttempt = runCatching {
        withTimeoutOrFail(TestTimeouts.MEDIUM_MS) {
          h.withInterpreter(TestModels.IC) { }
        }
      }

      assertTrue("First startup should fail", firstAttempt.isFailure)

      withTimeoutOrFail(TestTimeouts.MEDIUM_MS) {
        h.withInterpreter(TestModels.IC) { }
      }
    }
  }
}
