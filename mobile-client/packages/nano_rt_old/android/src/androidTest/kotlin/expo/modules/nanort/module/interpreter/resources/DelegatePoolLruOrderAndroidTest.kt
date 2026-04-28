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
class DelegatePoolLruOrderAndroidTest {

  private class FakeDelegate(
    val id: String,
    private val onClose: (String) -> Unit,
  ) : AutoCloseable {
    override fun close() = onClose(id)
  }

  @Test
  fun lru_must_evict_least_recently_used_not_most_recently_touched() {
    val closes = mutableListOf<String>()
    val created = AtomicInteger(0)

    val pool = DelegatePool(
      capacity = 2,
      isSupported = { true },
      createDelegate = { _, _, _ ->
        val id = "d${created.incrementAndGet()}"
        FakeDelegate(id) { closes += it }
      },
      closeDelegate = { it.close() },
      cacheDirProvider = { File(".") },
    )

    pool.bindToCurrentThread()

    val hA1 = pool.acquire(ModelId.RS, "tokA")
    pool.release(hA1)

    val hB1 = pool.acquire(ModelId.RS, "tokB")
    pool.release(hB1)

    val hA2 = pool.acquire(ModelId.RS, "tokA")
    pool.release(hA2)

    val hC1 = pool.acquire(ModelId.RS, "tokC")
    pool.release(hC1)

    assertTrue("Expected exactly one eviction close, got=$closes", closes.size == 1)

    val snapshot = pool.snapshot().entries
    val tokens = snapshot.map { it.token }.toSet()
    assertTrue("A should remain as most recently touched", "tokA" in tokens)
    assertTrue("C should be present as latest inserted", "tokC" in tokens)
    assertTrue("B should be evicted as LRU", "tokB" !in tokens)
    assertEquals("Cache size should match capacity", 2, snapshot.size)

    pool.closeAll()
  }
}
