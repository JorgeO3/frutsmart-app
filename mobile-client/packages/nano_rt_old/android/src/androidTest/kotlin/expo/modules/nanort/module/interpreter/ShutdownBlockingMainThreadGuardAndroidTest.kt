package expo.modules.nanort.module.interpreter

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class ShutdownBlockingMainThreadGuardAndroidTest {

  @Test
  fun shutdownBlocking_on_main_thread_must_fail_fast() {
    var error: Throwable? = null

    InstrumentationRegistry.getInstrumentation().runOnMainSync {
      error = runCatching { ModelManager.shutdownBlocking() }.exceptionOrNull()
    }

    val ex = error
    assertTrue("Expected IllegalStateException on main thread", ex is IllegalStateException)
    assertTrue(
      "Expected explicit guardrail message",
      (ex as? IllegalStateException)?.message?.contains("main_thread", ignoreCase = true) == true
    )
  }
}
