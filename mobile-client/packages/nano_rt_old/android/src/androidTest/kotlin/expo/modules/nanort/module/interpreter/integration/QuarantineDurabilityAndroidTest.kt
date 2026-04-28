package expo.modules.nanort.module.interpreter.integration

import androidx.test.ext.junit.runners.AndroidJUnit4
import expo.modules.nanort.module.interpreter.ModelId
import expo.modules.nanort.module.interpreter.internal.GpuQuarantineStore
import expo.modules.nanort.module.interpreter.testing.FakePrefsDisk
import expo.modules.nanort.module.interpreter.testing.FakeSharedPreferences
import expo.modules.nanort.module.interpreter.testing.NanoRtTestRule
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class QuarantineDurabilityAndroidTest {

  @get:Rule val rt = NanoRtTestRule(gpuEnabled = false)

  @Test
  fun quarantine_write_must_be_durable_across_restart_simulation() {
    val disk = FakePrefsDisk()

    val prefs1 = FakeSharedPreferences(disk)
    val store1 = GpuQuarantineStore(preferencesOverride = prefs1)
    store1.setQuarantinedWithReason(ModelId.RS, "gpu_crash")

    val prefs2 = FakeSharedPreferences(disk)
    val store2 = GpuQuarantineStore(preferencesOverride = prefs2)

    assertTrue("Quarantine should persist across restart simulation", store2.isQuarantined(ModelId.RS))
  }
}
