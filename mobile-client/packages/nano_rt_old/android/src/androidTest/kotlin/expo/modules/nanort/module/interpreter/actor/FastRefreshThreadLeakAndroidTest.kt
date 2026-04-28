package expo.modules.nanort.module.interpreter.actor

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.filters.LargeTest
import expo.modules.nanort.module.interpreter.testing.NanoRtHarness
import expo.modules.nanort.module.interpreter.testing.NanoRtTestRule
import expo.modules.nanort.module.interpreter.testing.TestModels
import expo.modules.nanort.module.interpreter.testing.TestTimeouts
import expo.modules.nanort.module.interpreter.testing.ThreadIntrospection
import expo.modules.nanort.module.interpreter.testing.withTimeoutOrFail
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
@LargeTest
class FastRefreshThreadLeakAndroidTest {

  @get:Rule val rt = NanoRtTestRule(gpuEnabled = false)

  @Test
  fun repeated_create_destroy_cycles_must_not_leak_nano_rt_threads() {
    val baseline = ThreadIntrospection.countAliveThreadsWithNamePrefix("NanoRT-Thread")

    repeat(3) {
      val h = NanoRtHarness.real(rt.context)
      h.installIfNeeded()
      runBlocking {
        withTimeoutOrFail(TestTimeouts.MEDIUM_MS) { h.withInterpreter(TestModels.IC) { } }
        withTimeoutOrFail(TestTimeouts.MEDIUM_MS) { h.shutdown() }
      }
      h.close()
    }

    val after = ThreadIntrospection.countAliveThreadsWithNamePrefix("NanoRT-Thread")
    assertTrue(
      "Thread leak detected baseline=$baseline after=$after",
      after <= baseline + 1,
    )
  }
}
