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
class DelegatePoolTokenKeyUniquenessAndroidTest {

  private class FakeDelegate : AutoCloseable {
    override fun close() = Unit
  }

  @Test
  fun key_must_include_full_token_to_avoid_collisions() {
    val created = AtomicInteger(0)
    val pool = DelegatePool(
      capacity = 8,
      isSupported = { true },
      createDelegate = { _, _, _ ->
        created.incrementAndGet()
        FakeDelegate()
      },
      closeDelegate = { it.close() },
      cacheDirProvider = { File(".") },
    )

    pool.bindToCurrentThread()

    val t1 = "aaaaaaaa1111111111111111"
    val t2 = "aaaaaaaa2222222222222222"

    val h1 = pool.acquire(ModelId.RS, t1)
    pool.release(h1)
    val h2 = pool.acquire(ModelId.RS, t2)
    pool.release(h2)

    assertEquals("Different full tokens must produce distinct entries", 2, created.get())

    val tokens = pool.snapshot().entries.map { it.token }.toSet()
    assertTrue("Expected first token in cache", t1 in tokens)
    assertTrue("Expected second token in cache", t2 in tokens)
  }
}
