package expo.modules.nanort.module.interpreter

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import expo.modules.nanort.BuildConfig
import expo.modules.nanort.core.AppAssets
import expo.modules.nanort.core.ModuleLogger
import java.util.concurrent.atomic.AtomicBoolean
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class InterpreterWarmerPolicyAndroidTest {

  @Test
  fun warmup_should_fail_when_any_model_fails_and_always_notify_finish() {
    val app = InstrumentationRegistry.getInstrumentation().targetContext.applicationContext as android.app.Application
    AppAssets.init(app)
    ModuleLogger.init(application = app, isDebug = BuildConfig.DEBUG, prefix = "NanoRT")

    runBlocking {
      val notified = AtomicBoolean(false)

      val result = runCatching {
        InterpreterWarmer.warmUp(
          modelsToWarmUp = listOf(ModelId.RS, ModelId.IC),
          runModelWarmup = { modelId ->
            if (modelId == ModelId.IC) throw IllegalStateException("forced_fail")
          },
          releaseSession = { },
          notifyFinished = { notified.set(true) },
        )
      }

      assertTrue("Warmup should fail if any model failed", result.isFailure)
      assertTrue("Warmup should always notify finish", notified.get())

      val ex = result.exceptionOrNull()
      assertTrue(ex is InterpreterWarmer.WarmupFailedException)
      val warmupEx = ex as InterpreterWarmer.WarmupFailedException
      assertEquals(1, warmupEx.result.failedCount)
      assertEquals(1, warmupEx.result.succeededCount)
      assertFalse(warmupEx.result.isSuccessful)
    }
  }
}
