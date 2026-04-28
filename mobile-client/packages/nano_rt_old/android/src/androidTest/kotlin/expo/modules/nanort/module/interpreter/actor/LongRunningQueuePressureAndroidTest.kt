package expo.modules.nanort.module.interpreter.actor

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.filters.LargeTest
import expo.modules.nanort.module.interpreter.ModelId
import expo.modules.nanort.module.interpreter.testing.NanoRtTestRule
import expo.modules.nanort.module.interpreter.testing.TestTimeouts
import expo.modules.nanort.module.interpreter.testing.ThreadIntrospection
import expo.modules.nanort.module.interpreter.testing.withTimeoutOrFail
import java.util.concurrent.atomic.AtomicInteger
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.joinAll
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
@LargeTest
class LongRunningQueuePressureAndroidTest {

  @get:Rule val rt = NanoRtTestRule(gpuEnabled = false)

  @Test
  fun sustained_queue_pressure_must_not_deadlock_or_leak_actor_resources() {
    runBlocking {
      val h = rt.harness
      val models = listOf(ModelId.IC, ModelId.EC, ModelId.RS)

      val baselineThreads = ThreadIntrospection.countAliveThreadsWithNamePrefix("NanoRT-Thread")
      withTimeoutOrFail(TestTimeouts.MEDIUM_MS) { h.withInterpreter(ModelId.IC) { } }

      val actor = h.installedTestActor
      assertNotNull("Actor was not installed for pressure test", actor)
      val baselineChildJobs = actor!!.debugSnapshotForSoak().childJobCount

      val successes = AtomicInteger(0)
      val failures = AtomicInteger(0)
      val durationMs = 12_000L
      val deadlineMs = System.currentTimeMillis() + durationMs
      val workers = 6

      val jobs = (0 until workers).map { workerId ->
        launch(Dispatchers.Default) {
          var n = workerId
          while (System.currentTimeMillis() < deadlineMs) {
            val model = models[n % models.size]
            val ok = runCatching {
              withTimeoutOrFail(TestTimeouts.MEDIUM_MS) {
                h.withInterpreter(model) {
                  if (n % 5 == 0) delay(2)
                }
              }
            }.isSuccess

            if (ok) successes.incrementAndGet() else failures.incrementAndGet()
            n += 1
          }
        }
      }

      withTimeoutOrFail(TestTimeouts.STRESS_MS) { jobs.joinAll() }

      assertTrue("Queue pressure produced failures=${failures.get()}", failures.get() == 0)
      assertTrue("Too few successful runs under pressure: ${successes.get()}", successes.get() >= 300)

      val afterChildJobs = actor.debugSnapshotForSoak().childJobCount
      assertTrue(
        "Child jobs leaked under pressure baseline=$baselineChildJobs after=$afterChildJobs",
        afterChildJobs <= baselineChildJobs + 2
      )

      val afterThreads = ThreadIntrospection.countAliveThreadsWithNamePrefix("NanoRT-Thread")
      assertTrue(
        "NanoRT thread leak under pressure baseline=$baselineThreads after=$afterThreads",
        afterThreads <= baselineThreads + 1
      )
    }
  }
}
