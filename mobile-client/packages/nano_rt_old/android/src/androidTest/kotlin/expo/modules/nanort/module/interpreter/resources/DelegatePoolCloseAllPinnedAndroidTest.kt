package expo.modules.nanort.module.interpreter.resources

import androidx.test.ext.junit.runners.AndroidJUnit4
import expo.modules.nanort.module.interpreter.ModelId
import expo.modules.nanort.module.interpreter.internal.DelegatePool
import java.io.File
import java.util.concurrent.atomic.AtomicInteger
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class DelegatePoolCloseAllPinnedAndroidTest {

  private class FakeDelegate(private val onClose: () -> Unit) : AutoCloseable {
    override fun close() = onClose()
  }

  @Test
  fun closeAll_must_not_close_pinned_delegate() {
    val closes = AtomicInteger(0)
    val pool = DelegatePool(
      capacity = 2,
      isSupported = { true },
      createDelegate = { _, _, _ -> FakeDelegate { closes.incrementAndGet() } },
      closeDelegate = { it.close() },
      cacheDirProvider = { File(".") },
    )

    pool.bindToCurrentThread()
    val handle = pool.acquire(ModelId.IC, "tok-a")

    pool.closeAll()
    assertEquals("Pinned delegate should not be closed by closeAll", 0, closes.get())
    assertTrue("Pinned entry should remain in pool", pool.snapshot().entries.isNotEmpty())

    pool.release(handle)
    pool.closeAll()
    assertEquals("Delegate should close after release + closeAll", 1, closes.get())
    assertTrue("Pool should be empty after closing unpinned entries", pool.snapshot().entries.isEmpty())
  }
}
