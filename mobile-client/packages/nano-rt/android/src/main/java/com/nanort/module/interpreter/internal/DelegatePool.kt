package com.nanort.module.interpreter.internal

import android.content.Context
import androidx.annotation.VisibleForTesting
import com.nanort.core.AppAssets
import com.nanort.core.ModuleLogger
import com.nanort.core.logI
import com.nanort.core.logW
import com.nanort.module.interpreter.ModelId
import org.tensorflow.lite.gpu.CompatibilityList
import org.tensorflow.lite.gpu.GpuDelegate
import org.tensorflow.lite.gpu.GpuDelegateFactory
import java.io.File
import java.util.LinkedHashMap
import java.util.concurrent.atomic.AtomicReference

internal class DelegatePool<D : AutoCloseable> internal constructor(
  private val capacity: Int,
  private val isSupported: () -> Boolean,
  private val createDelegate: (ModelId, String, File) -> D,
  private val closeDelegate: (D) -> Unit,
  private val cacheDirProvider: () -> File,
  private val enforceThreadAffinity: Boolean = true,
  private val tag: String = ModuleLogger.createTag("DelegatePool"),
) {
  @Deprecated("Compatibility constructor for tests")
  internal constructor(
    capacity: Int,
    compat: CompatibilityList,
    context: Context = AppAssets.getContext(),
    delegateFactory: (GpuDelegateFactory.Options) -> D,
  ) : this(
    capacity = capacity,
    isSupported = { compat.isDelegateSupportedOnThisDevice },
    createDelegate = { _, token, cacheDir ->
      val opts = compat.bestOptionsForThisDevice.apply {
        setInferencePreference(GpuDelegateFactory.Options.INFERENCE_PREFERENCE_SUSTAINED_SPEED)
        isPrecisionLossAllowed = true
        if (InferenceFlags.gpuSerializationEnabled) {
          setSerializationParams(cacheDir.absolutePath, token)
        }
      }
      delegateFactory(opts)
    },
    closeDelegate = { it.close() },
    cacheDirProvider = { ensureCacheDir(context) },
    enforceThreadAffinity = false,
  )

  init {
    require(capacity >= 0) { "delegate_pool_capacity_invalid capacity=$capacity" }
  }

  @ConsistentCopyVisibility
  data class Handle<D : AutoCloseable> internal constructor(
    val key: Key,
    val delegate: D,
    val tokenPrefix: String,
    val handleId: Long,
  ) {
    val modelId: ModelId get() = key.modelId
  }

  data class Key internal constructor(
    val modelId: ModelId,
    val token: String,
  )

  private data class Entry<D : AutoCloseable>(
    val handle: Handle<D>,
    var refCount: Int,
  )

  private val lru = object : LinkedHashMap<Key, Entry<D>>(8, 0.75f, true) {}
  private val accessLock = Any()
  private val ownerThreadRef = AtomicReference<Thread?>(null)
  private var nextHandleId: Long = 1L

  fun bindToCurrentThread() {
    bindToThread(Thread.currentThread())
  }

  fun bindToThread(thread: Thread) {
    val existing = ownerThreadRef.get()
    if (existing === thread) return
    check(existing == null) {
      "delegate_pool_thread_rebind_forbidden existing=${existing?.name} new=${thread.name}"
    }
    ownerThreadRef.set(thread)
  }

  fun clearOwnerThread() {
    ownerThreadRef.set(null)
  }

  fun acquire(modelId: ModelId, token: String): Handle<D> = withPoolAccess {
    checkThread("acquire")
    val key = Key(modelId, token)
    lru[key]?.let { e ->
      e.refCount += 1
      logI(tag) { "gpu_delegate_acquire_hit model=${modelId.name} ref=${e.refCount}" }
      return@withPoolAccess e.handle
    }

    if (!isSupported()) {
      throw IllegalStateException("delegate_unsupported model=${modelId.name}")
    }

    val cacheDir = cacheDirProvider()
    val delegate = createDelegate(modelId, token, cacheDir)
    val handle = Handle(key, delegate, token.take(8), handleId = nextHandleId++)
    lru[key] = Entry(handle, refCount = 1)

    logI(tag) {
      "gpu_delegate_create model=${modelId.name} token=${handle.tokenPrefix} cacheDir=${cacheDir.absolutePath}"
    }

    evictIfNeeded()
    handle
  }

  fun release(handle: Handle<D>) = withPoolAccess {
    checkThread("release")
    val e = getEntryNoTouch(handle.key)
      ?: throw IllegalStateException("delegate_release_unknown model=${handle.modelId.name}")
    check(e.handle.handleId == handle.handleId) {
      "delegate_release_stale model=${handle.modelId.name} expected=${e.handle.handleId} actual=${handle.handleId}"
    }
    check(e.refCount > 0) {
      "delegate_release_double model=${handle.modelId.name} handle=${handle.handleId}"
    }
    e.refCount -= 1
    logI(tag) { "gpu_delegate_release model=${handle.modelId.name} ref=${e.refCount}" }
    evictIfNeeded()
  }

  fun closeAll() = withPoolAccess {
    checkThread("closeAll")
    val it = lru.entries.iterator()
    while (it.hasNext()) {
      val (_, entry) = it.next()
      if (entry.refCount == 0) {
        it.remove()
        closeDelegateSafely(entry.handle.delegate, "close_all", entry.handle.modelId)
      } else {
        logW(tag) { "gpu_delegate_close_all_skip_pinned model=${entry.handle.modelId.name} ref=${entry.refCount}" }
      }
    }
  }

  private fun evictIfNeeded() {
    if (lru.size <= capacity) return

    val it = lru.entries.iterator()
    while (lru.size > capacity && it.hasNext()) {
      val (key, entry) = it.next()
      if (entry.refCount == 0) {
        it.remove()
        closeDelegateSafely(entry.handle.delegate, "evict", key.modelId)
        logI(tag) { "gpu_delegate_evict model=${key.modelId.name}" }
      }
    }
  }

  private fun checkThread(op: String) {
    if (!enforceThreadAffinity) return
    val owner = ownerThreadRef.get()
      ?: throw IllegalStateException("delegate_pool_unbound op=$op")
    check(Thread.currentThread() === owner) {
      "delegate_pool_thread_violation op=$op expected=${owner.name} actual=${Thread.currentThread().name}"
    }
  }

  private inline fun <T> withPoolAccess(block: () -> T): T {
    if (enforceThreadAffinity) return block()
    synchronized(accessLock) {
      return block()
    }
  }

  private fun getEntryNoTouch(key: Key): Entry<D>? {
    for ((k, value) in lru) {
      if (k == key) return value
    }
    return null
  }

  private fun closeDelegateSafely(delegate: D, reason: String, modelId: ModelId) {
    try {
      closeDelegate(delegate)
    } catch (t: Throwable) {
      if (t is Error) throw t
      logW(tag, t) { "gpu_delegate_close_fail model=${modelId.name} reason=$reason" }
    }
  }

  @VisibleForTesting
  internal fun snapshot(): Snapshot<D> = withPoolAccess {
    checkThread("snapshot")
    val entries = lru.entries.map { (key, entry) ->
      EntrySnapshot(
        modelId = key.modelId,
        token = key.token,
        handleId = entry.handle.handleId,
        refCount = entry.refCount,
        delegate = entry.handle.delegate
      )
    }
    Snapshot(entries)
  }

  @VisibleForTesting
  internal data class Snapshot<D : AutoCloseable>(
    val entries: List<EntrySnapshot<D>>,
  )

  @VisibleForTesting
  internal data class EntrySnapshot<D : AutoCloseable>(
    val modelId: ModelId,
    val token: String,
    val handleId: Long,
    val refCount: Int,
    val delegate: D,
  )

  companion object {
    fun gpu(
      capacity: Int,
      compat: CompatibilityList,
      context: Context = AppAssets.getContext(),
    ): DelegatePool<GpuDelegate> {
      return DelegatePool(
        capacity = capacity,
        isSupported = { compat.isDelegateSupportedOnThisDevice },
        createDelegate = { _, token, cacheDir ->
          val opts = compat.bestOptionsForThisDevice.apply {
            setInferencePreference(GpuDelegateFactory.Options.INFERENCE_PREFERENCE_SUSTAINED_SPEED)
            isPrecisionLossAllowed = true
            if (InferenceFlags.gpuSerializationEnabled) {
              setSerializationParams(cacheDir.absolutePath, token)
            }
          }
          GpuDelegate(opts)
        },
        closeDelegate = { it.close() },
        cacheDirProvider = { ensureCacheDir(context) },
        tag = ModuleLogger.createTag("DelegatePool"),
      )
    }

    private fun ensureCacheDir(context: Context): File {
      val base = context.codeCacheDir
      val dir = File(base, "tflite_gpu_cache")
      if (dir.exists()) {
        check(dir.isDirectory) { "gpu_cache_dir_not_directory path=${dir.absolutePath}" }
        return dir
      }
      val ok = dir.mkdirs()
      check(ok && dir.isDirectory) { "gpu_cache_dir_create_failed path=${dir.absolutePath}" }
      return dir
    }
  }
}
