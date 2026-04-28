package expo.modules.nanort.module.interpreter.persistence

import android.content.SharedPreferences
import androidx.test.ext.junit.runners.AndroidJUnit4
import expo.modules.nanort.module.interpreter.ModelId
import expo.modules.nanort.module.interpreter.internal.GpuQuarantineStore
import expo.modules.nanort.module.interpreter.testing.FakePrefsDisk
import expo.modules.nanort.module.interpreter.testing.FakeSharedPreferences
import expo.modules.nanort.module.interpreter.testing.NanoRtTestRule
import java.util.concurrent.atomic.AtomicInteger
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class QuarantineAtomicityAndroidTest {

  @get:Rule val rt = NanoRtTestRule(gpuEnabled = false)

  @Test
  fun quarantine_write_must_use_commit_not_apply_for_durability() {
    val disk = FakePrefsDisk()
    val base = FakeSharedPreferences(disk)

    val commitCount = AtomicInteger(0)
    val applyCount = AtomicInteger(0)

    val countingPrefs = CountingSharedPreferences(base, commitCount, applyCount)
    val store = GpuQuarantineStore(preferencesOverride = countingPrefs)

    store.setQuarantinedWithReason(ModelId.RS, "gpu_crash")

    assertTrue("Expected commit() >= 1, got=${commitCount.get()}", commitCount.get() >= 1)
    assertEquals("Quarantine writes must not use apply()", 0, applyCount.get())
    assertTrue("Store should mark model as quarantined", store.isQuarantined(ModelId.RS))
  }

  private class CountingSharedPreferences(
    private val delegate: SharedPreferences,
    private val commitCount: AtomicInteger,
    private val applyCount: AtomicInteger,
  ) : SharedPreferences by delegate {

    override fun edit(): SharedPreferences.Editor {
      return CountingEditor(delegate.edit(), commitCount, applyCount)
    }
  }

  private class CountingEditor(
    private val editor: SharedPreferences.Editor,
    private val commitCount: AtomicInteger,
    private val applyCount: AtomicInteger,
  ) : SharedPreferences.Editor by editor {

    override fun apply() {
      applyCount.incrementAndGet()
      editor.apply()
    }

    override fun commit(): Boolean {
      commitCount.incrementAndGet()
      return editor.commit()
    }
  }
}
