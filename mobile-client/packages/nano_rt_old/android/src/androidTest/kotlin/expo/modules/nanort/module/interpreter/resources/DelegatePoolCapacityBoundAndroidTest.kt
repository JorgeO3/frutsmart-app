package expo.modules.nanort.module.interpreter.resources

import androidx.test.ext.junit.runners.AndroidJUnit4
import expo.modules.nanort.module.interpreter.ModelId
import expo.modules.nanort.module.interpreter.internal.DelegatePool
import java.io.File
import java.util.concurrent.atomic.AtomicInteger
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class DelegatePoolCapacityBoundAndroidTest {

  private class FakeDelegate(private val onClose: () -> Unit) : AutoCloseable {
    override fun close() = onClose()
  }

  @Test
  fun cache_size_must_never_exceed_capacity_after_many_acquires() {
    val closes = AtomicInteger(0)
    val capacity = 3
    val pool = DelegatePool(
      capacity = capacity,
      isSupported = { true },
      createDelegate = { _, _, _ -> FakeDelegate { closes.incrementAndGet() } },
      closeDelegate = { it.close() },
      cacheDirProvider = { File(".") },
    )

    pool.bindToCurrentThread()

    val models = listOf(ModelId.BS, ModelId.IC, ModelId.EC)
    repeat(80) { i ->
      val token = "tok_${i}"
      val handle = pool.acquire(models[i % models.size], token)
      pool.release(handle)

      val size = pool.snapshot().entries.size
      assertTrue("LRU exceeded capacity size=$size cap=$capacity", size <= capacity)
    }

    pool.closeAll()
  }
}
