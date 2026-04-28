package expo.modules.nanort.module.interpreter.resources

import androidx.test.ext.junit.runners.AndroidJUnit4
import expo.modules.nanort.module.interpreter.ModelId
import expo.modules.nanort.module.interpreter.internal.DelegatePool
import java.io.File
import java.util.concurrent.atomic.AtomicInteger
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.joinAll
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class DelegatePoolConcurrencyAndroidTest {

  private class FakeDelegate(private val onClose: () -> Unit) : AutoCloseable {
    override fun close() = onClose()
  }

  @Test
  fun pinned_delegate_must_not_be_closed_while_in_use_under_concurrency() {
    val pinnedCloseCount = AtomicInteger(0)
    val created = AtomicInteger(0)

    val pool = DelegatePool(
      capacity = 4,
      isSupported = { true },
      createDelegate = { _, _, _ ->
        if (created.getAndIncrement() == 0) {
          FakeDelegate { pinnedCloseCount.incrementAndGet() }
        } else {
          FakeDelegate { }
        }
      },
      closeDelegate = { it.close() },
      cacheDirProvider = { File(".") },
      enforceThreadAffinity = false,
    )

    val pinned = pool.acquire(ModelId.RS, token = "PINNED_TOKEN")

    runBlocking {
      withTimeout(20_000) {
        val jobs = mutableListOf<Job>()
        repeat(12) { worker ->
          jobs += launch(Dispatchers.Default) {
            repeat(80) { i ->
              val model = ModelId.entries[(worker + i) % ModelId.entries.size]
              val token = "w${worker}_i${i}"
              val handle = pool.acquire(model, token)
              delay((i % 3).toLong())
              pool.release(handle)
            }
          }
        }
        jobs.joinAll()
      }
    }

    assertEquals("Pinned delegate must not close while refCount > 0", 0, pinnedCloseCount.get())

    pool.release(pinned)
    pool.closeAll()

    assertTrue("Pinned delegate should close after release + closeAll", pinnedCloseCount.get() >= 1)
    assertTrue("Pool cache must remain bounded", pool.snapshot().entries.size <= 4)
  }
}
