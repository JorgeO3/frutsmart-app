package expo.modules.nanort.module.workflows

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.filters.LargeTest
import expo.modules.nanort.module.interpreter.InterpreterWarmer
import expo.modules.nanort.module.interpreter.ModelId
import expo.modules.nanort.module.interpreter.ModelManager
import expo.modules.nanort.module.interpreter.testing.NanoRtTestRule
import expo.modules.nanort.module.interpreter.testing.TestTimeouts
import expo.modules.nanort.module.interpreter.testing.withTimeoutOrFail
import java.util.Locale
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
@LargeTest
class WarmupBenchmarkAndroidTest {

  @get:Rule val rt = NanoRtTestRule(gpuEnabled = false)

  @Test
  fun warmup_should_complete_with_stable_runtime_and_bounded_latency() {
    runBlocking {
      val samplesMs = mutableListOf<Double>()
      val models = listOf(ModelId.RS, ModelId.BS, ModelId.SS, ModelId.EC, ModelId.IC)

      repeat(3) {
        withTimeoutOrFail(TestTimeouts.LONG_MS) {
          ModelManager.shutdown()
        }

        val t0 = System.nanoTime()
        withTimeoutOrFail(TestTimeouts.STRESS_MS) {
          InterpreterWarmer.warmUp()
        }
        val warmupMs = (System.nanoTime() - t0) / 1_000_000.0
        samplesMs += warmupMs

        withTimeoutOrFail(TestTimeouts.LONG_MS) {
          for (model in models) {
            ModelManager.withInterpreter(model) { }
          }
          ModelManager.releaseCurrentSession()
        }

        val snapshot = ModelManager.actorDebugSnapshotForSoak()
        assertTrue("Warmup produced fatal terminations", snapshot.fatalTerminationCount == 0L)
        assertTrue("Warmup left pending replies", snapshot.pendingReplies == 0)
        assertTrue("Warmup left mailbox not drained", snapshot.approxMailboxDepth == 0L)
      }

      val p95Ms = p95(samplesMs)
      assertTrue(
        "Warmup p95 too high: ${String.format(Locale.US, "%.2f", p95Ms)}ms samples=$samplesMs",
        p95Ms <= 30_000.0
      )
    }
  }

  private fun p95(values: List<Double>): Double {
    if (values.isEmpty()) return 0.0
    val sorted = values.sorted()
    val idx = ((sorted.size - 1) * 0.95).toInt().coerceIn(0, sorted.size - 1)
    return sorted[idx]
  }
}
