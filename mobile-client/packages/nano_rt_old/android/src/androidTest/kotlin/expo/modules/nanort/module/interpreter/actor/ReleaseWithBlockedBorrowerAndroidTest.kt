package expo.modules.nanort.module.interpreter.actor

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.filters.LargeTest
import expo.modules.nanort.module.interpreter.testing.NanoRtTestRule
import expo.modules.nanort.module.interpreter.testing.SuspendGate
import expo.modules.nanort.module.interpreter.testing.TestModels
import expo.modules.nanort.module.interpreter.testing.TestTimeouts
import expo.modules.nanort.module.interpreter.testing.withTimeoutOrFail
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
@LargeTest
class ReleaseWithBlockedBorrowerAndroidTest {

  @get:Rule val rt = NanoRtTestRule(gpuEnabled = false)

  @Test
  fun release_waits_for_inflight_borrower_and_then_succeeds() {
    runBlocking {
      val h = rt.harness
      val entered = CompletableDeferred<Unit>()
      val gate = SuspendGate()

      val borrower = launch(Dispatchers.Default) {
        h.withInterpreter(TestModels.IC) {
          entered.complete(Unit)
          gate.await(TestTimeouts.LONG_MS)
        }
      }

      withTimeoutOrFail(TestTimeouts.MEDIUM_MS) { entered.await() }

      val release = async(Dispatchers.Default) { runCatching { h.releaseCurrentSession() } }

      delay(250)
      assertFalse("release completed while borrower lease was still active", release.isCompleted)

      gate.open()

      val releaseResult = withTimeoutOrFail(TestTimeouts.LONG_MS) { release.await() }
      assertTrue("release must complete after borrower unblocks", releaseResult.isSuccess)

      withTimeoutOrFail(TestTimeouts.MEDIUM_MS) { borrower.join() }
      withTimeoutOrFail(TestTimeouts.MEDIUM_MS) { h.withInterpreter(TestModels.IC) { } }
    }
  }
}
