package expo.modules.nanort.module.interpreter

import androidx.test.ext.junit.runners.AndroidJUnit4
import expo.modules.nanort.module.interpreter.internal.GpuQuarantineStore
import expo.modules.nanort.module.interpreter.testing.FakePrefsDisk
import expo.modules.nanort.module.interpreter.testing.FakeSharedPreferences
import expo.modules.nanort.module.interpreter.testing.NanoRtTestRule
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class GpuQuarantineStoreAndroidTest {

  @get:Rule val rt = NanoRtTestRule(gpuEnabled = false)

  @Test
  fun quarantine_store_persists_and_clears() {
    val disk = FakePrefsDisk()
    val prefs = FakeSharedPreferences(disk)
    val store = GpuQuarantineStore(preferencesOverride = prefs)

    val model = ModelId.RS
    val other = ModelId.BS

    store.clear(model)
    store.clear(other)

    assertFalse(store.isQuarantined(model))
    assertNull(store.getLastReason(model))

    store.setQuarantinedWithReason(model, "gpu_crash_xyz")
    assertTrue(store.isQuarantined(model))
    assertTrue(store.getLastReason(model)?.contains("gpu_crash") == true)

    assertFalse(store.isQuarantined(other))
    assertNull(store.getLastReason(other))

    val allKeys = prefs.getAll().keys
    assertTrue("Expected key names to include model id", allKeys.any { it.contains(model.name) })

    store.clear(model)
    assertFalse(store.isQuarantined(model))
    assertNull(store.getLastReason(model))
  }
}
