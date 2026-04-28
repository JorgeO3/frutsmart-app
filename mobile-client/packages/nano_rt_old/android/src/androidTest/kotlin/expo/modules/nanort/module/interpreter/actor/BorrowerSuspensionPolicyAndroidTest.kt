package expo.modules.nanort.module.interpreter.actor

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.filters.LargeTest
import expo.modules.nanort.module.interpreter.testing.NanoRtTestRule
import expo.modules.nanort.module.interpreter.testing.TestModels
import expo.modules.nanort.module.interpreter.testing.TestTimeouts
import expo.modules.nanort.module.interpreter.testing.withTimeoutOrFail
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
@LargeTest
class BorrowerSuspensionPolicyAndroidTest {

  @get:Rule val rt = NanoRtTestRule(gpuEnabled = false)

  @Test
  fun caller_cancellation_must_release_actor_when_borrower_is_suspended() {
    runBlocking {
      val h = rt.harness
      val entered = CompletableDeferred<Unit>()

      val borrowerJob = launch(Dispatchers.Default) {
        h.withInterpreter(TestModels.IC) {
          entered.complete(Unit)
          while (true) {
            delay(1_000)
          }
        }
      }

      withTimeoutOrFail(TestTimeouts.MEDIUM_MS) { entered.await() }
      borrowerJob.cancel(CancellationException("test_cancel"))

      val cancelObserved = runCatching {
        withTimeoutOrFail(TestTimeouts.MEDIUM_MS) { borrowerJob.join() }
      }
      assertTrue("borrower job should complete after cancellation", cancelObserved.isSuccess)

      withTimeoutOrFail(TestTimeouts.MEDIUM_MS) { h.withInterpreter(TestModels.IC) { } }
    }
  }
}
