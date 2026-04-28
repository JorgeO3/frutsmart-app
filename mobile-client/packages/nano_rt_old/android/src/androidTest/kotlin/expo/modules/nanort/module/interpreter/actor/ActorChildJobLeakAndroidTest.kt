package expo.modules.nanort.module.interpreter.actor

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.filters.LargeTest
import expo.modules.nanort.module.interpreter.testing.NanoRtTestRule
import expo.modules.nanort.module.interpreter.testing.TestModels
import expo.modules.nanort.module.interpreter.testing.TestTimeouts
import expo.modules.nanort.module.interpreter.testing.withTimeoutOrFail
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
@LargeTest
class ActorChildJobLeakAndroidTest {

  @get:Rule val rt = NanoRtTestRule(gpuEnabled = false)

  @Test
  fun actor_should_not_leak_child_jobs_per_run() {
    runBlocking {
      val h = rt.harness

      withTimeoutOrFail(TestTimeouts.MEDIUM_MS) { h.withInterpreter(TestModels.IC) { } }

      val actor = h.installedTestActor
      assertNotNull("No hay actor instalado en harness", actor)

      val baseline = actor!!.debugSnapshotForSoak().childJobCount
      val iterations = 200

      withTimeoutOrFail(TestTimeouts.LONG_MS) {
        repeat(iterations) { h.withInterpreter(TestModels.IC) { } }
      }

      val after = actor.debugSnapshotForSoak().childJobCount

      assertTrue(
        "LEAK: child jobs crecieron. baseline=$baseline after=$after iters=$iterations",
        after <= baseline + 2
      )
    }
  }
}
