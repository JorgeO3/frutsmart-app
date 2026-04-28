package expo.modules.nanort.module.interpreter.actor

import androidx.test.ext.junit.runners.AndroidJUnit4
import expo.modules.nanort.module.interpreter.internal.InterpreterActor
import expo.modules.nanort.module.interpreter.internal.ModelManagerDebugHooks
import expo.modules.nanort.module.interpreter.testing.NanoRtTestRule
import expo.modules.nanort.module.interpreter.testing.TestModels
import expo.modules.nanort.module.interpreter.testing.TestTimeouts
import expo.modules.nanort.module.interpreter.testing.withTimeoutOrFail
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.yield
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class ShutdownDuringStartupRaceAndroidTest {

  @get:Rule val rt = NanoRtTestRule(gpuEnabled = false)

  @Test
  fun shutdown_during_starting_must_not_be_lost() {
    runBlocking {
      val h = rt.harness

      ModelManagerDebugHooks.startupDelayOnce(600)

      val firstRun = async(Dispatchers.Default) {
        runCatching {
          h.withInterpreter(TestModels.IC) { }
        }
      }

      val actor = h.installedTestActor as? InterpreterActor
      assertNotNull("Test actor should be installed", actor)
      val installed = requireNotNull(actor)

      withTimeoutOrFail(TestTimeouts.MEDIUM_MS) {
        while (installed.lifecycleNameForTests() == "NEW") {
          yield()
        }
      }

      withTimeoutOrFail(TestTimeouts.LONG_MS) {
        h.shutdown()
      }

      withTimeoutOrFail(TestTimeouts.LONG_MS) {
        while (installed.lifecycleNameForTests() != "NEW") {
          yield()
        }
      }

      assertEquals("Actor should return to NEW after shutdown", "NEW", installed.lifecycleNameForTests())
      assertFalse("Runtime must not remain alive after shutdown race", installed.hasRuntimeForTests())

      firstRun.await()
    }
  }
}
