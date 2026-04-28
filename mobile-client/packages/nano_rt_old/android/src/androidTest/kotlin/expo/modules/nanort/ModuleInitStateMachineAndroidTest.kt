package expo.modules.nanort

import androidx.test.ext.junit.runners.AndroidJUnit4
import kotlinx.coroutines.async
import kotlinx.coroutines.delay
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class ModuleInitStateMachineAndroidTest {

  @Test
  fun isReady_should_only_be_true_after_successful_completion() {
    val gate = ModuleInitStateMachine()

    assertFalse(gate.isReady())
    assertTrue(gate.markInitializingIfIdle())
    assertFalse(gate.isReady())

    gate.markFailure(IllegalStateException("warmup_fail"))
    assertFalse(gate.isReady())

    assertTrue(gate.resetForRetryIfFailed())
    assertTrue(gate.markInitializingIfIdle())
    gate.markReady()
    assertTrue(gate.isReady())
  }

  @Test
  fun awaitReady_should_resume_on_ready_and_fail_on_error() {
    runBlocking {
      val successGate = ModuleInitStateMachine()
      assertTrue(successGate.markInitializingIfIdle())
      val waiter = async { successGate.awaitReady() }
      delay(50)
      successGate.markReady()
      waiter.await()
      assertTrue(successGate.isReady())

      val failGate = ModuleInitStateMachine()
      assertTrue(failGate.markInitializingIfIdle())
      val failingWaiter = async {
        runCatching { failGate.awaitReady() }.isFailure
      }
      delay(50)
      failGate.markFailure(IllegalStateException("init_failed"))
      assertTrue(failingWaiter.await())
      assertFalse(failGate.isReady())
    }
  }
}
