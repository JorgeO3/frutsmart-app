package expo.modules.nanort.module.interpreter.integration

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.filters.LargeTest
import expo.modules.nanort.module.interpreter.ModelId
import expo.modules.nanort.module.interpreter.ModelManager
import expo.modules.nanort.module.interpreter.testing.NanoRtTestRule
import expo.modules.nanort.module.interpreter.testing.TestTimeouts
import expo.modules.nanort.module.interpreter.testing.withTimeoutOrFail
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
@LargeTest
class RealEngineShutdownStressAndroidTest {

  @get:Rule val rt = NanoRtTestRule(gpuEnabled = false)

  @Test
  fun repeated_real_engine_startup_and_shutdown_cycles_must_remain_stable() {
    runBlocking {
      val h = rt.harness
      val results = mutableListOf<Boolean>()

      repeat(12) { i ->
        val runOk = runCatching {
          withTimeoutOrFail(TestTimeouts.LONG_MS) {
            h.withInterpreter(ModelId.IC) { }
          }
        }.isSuccess
        results += runOk

        if (i % 3 == 2) {
          val shutdownOk = runCatching {
            withTimeoutOrFail(TestTimeouts.LONG_MS) { h.shutdown() }
          }.isSuccess
          results += shutdownOk
        }
      }

      val finalRun = runCatching {
        withTimeoutOrFail(TestTimeouts.LONG_MS) {
          h.withInterpreter(ModelId.IC) { }
        }
      }
      results += finalRun.isSuccess

      val snapshot = ModelManager.actorDebugSnapshotForSoak()
      assertTrue("Real-engine stress produced failures: $results", results.all { it })
      assertTrue("Actor reported fatal terminations", snapshot.fatalTerminationCount == 0L)
      assertTrue("Actor has pending replies after stress", snapshot.pendingReplies == 0)
      assertTrue("Actor mailbox not drained after stress", snapshot.approxMailboxDepth == 0L)
    }
  }
}
