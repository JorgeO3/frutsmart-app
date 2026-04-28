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
class DelegatePoolCloseAllIdempotencyAndroidTest {

  private class FakeDelegate(private val onClose: () -> Unit) : AutoCloseable {
    override fun close() = onClose()
  }

  @Test
  fun closeAll_should_be_idempotent_for_unpinned_entries() {
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
    pool.release(handle)

    pool.closeAll()
    pool.closeAll()

    assertEquals("Delegate must be closed exactly once", 1, closes.get())
    assertTrue("Pool should remain empty", pool.snapshot().entries.isEmpty())
  }
}
