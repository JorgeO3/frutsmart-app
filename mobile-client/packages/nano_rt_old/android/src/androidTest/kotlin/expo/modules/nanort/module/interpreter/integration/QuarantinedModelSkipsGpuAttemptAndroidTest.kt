package expo.modules.nanort.module.interpreter.integration

import androidx.test.ext.junit.runners.AndroidJUnit4
import expo.modules.nanort.module.interpreter.ModelId
import expo.modules.nanort.module.interpreter.ModelManager
import expo.modules.nanort.module.interpreter.internal.DelegatePool
import expo.modules.nanort.module.interpreter.internal.GpuPolicy
import expo.modules.nanort.module.interpreter.internal.GpuQuarantineStore
import expo.modules.nanort.module.interpreter.internal.InferenceFlags
import expo.modules.nanort.module.interpreter.internal.InterpreterActor
import expo.modules.nanort.module.interpreter.testing.FakePrefsDisk
import expo.modules.nanort.module.interpreter.testing.FakeSharedPreferences
import expo.modules.nanort.module.interpreter.testing.NanoRtTestRule
import expo.modules.nanort.module.interpreter.testing.TestTimeouts
import expo.modules.nanort.module.interpreter.testing.withTimeoutOrFail
import java.io.File
import java.util.concurrent.atomic.AtomicInteger
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.tensorflow.lite.gpu.CompatibilityList
import org.tensorflow.lite.gpu.GpuDelegate

@RunWith(AndroidJUnit4::class)
class QuarantinedModelSkipsGpuAttemptAndroidTest {

  @get:Rule val rt = NanoRtTestRule(gpuEnabled = true)

  @Test
  fun quarantined_model_must_skip_gpu_delegate_acquire_and_run_on_cpu() {
    runBlocking {
      val disk = FakePrefsDisk()
      val store = GpuQuarantineStore(preferencesOverride = FakeSharedPreferences(disk))
      store.setQuarantinedWithReason(ModelId.IC, "pre-existing quarantine")

      val compat = CompatibilityList()
      val policy = GpuPolicy(
        compat = compat,
        quarantine = store,
        compatSupportedOverride = { true },
        buildInfo = GpuPolicy.BuildInfo(
          fingerprint = "google/test/device:15/test/release-keys",
          manufacturer = "google",
          model = "pixel",
          device = "test_device",
          hardware = "ranchu",
        )
      )
      val acquireAttempts = AtomicInteger(0)
      val delegatePool = DelegatePool<GpuDelegate>(
        capacity = 2,
        isSupported = { true },
        createDelegate = { _, _, _ ->
          acquireAttempts.incrementAndGet()
          throw IllegalStateException("should_not_attempt_gpu_when_quarantined")
        },
        closeDelegate = { it.close() },
        cacheDirProvider = { File(".") },
      )

      InferenceFlags.gpuEnabled = true
      ModelManager.clearActorForTests()
      val actor = InterpreterActor(
        compat = compat,
        quarantine = store,
        gpuPolicy = policy,
        delegatePool = delegatePool,
      )
      ModelManager.installActorForTests(actor)

      try {
        withTimeoutOrFail(TestTimeouts.LONG_MS) {
          ModelManager.withInterpreter(ModelId.IC) { session -> session.runInference() }
        }

        assertEquals("GPU delegate acquire should not be attempted", 0, acquireAttempts.get())
        assertTrue("Model must remain quarantined", store.isQuarantined(ModelId.IC))
        val snapshot = ModelManager.actorDebugSnapshotForSoak()
        assertFalse("Quarantined path should be CPU", snapshot.gpuDelegateActive)
      } finally {
        runCatching { withTimeoutOrFail(TestTimeouts.LONG_MS) { ModelManager.shutdown() } }
        runCatching { ModelManager.clearActorForTests() }
      }
    }
  }
}
