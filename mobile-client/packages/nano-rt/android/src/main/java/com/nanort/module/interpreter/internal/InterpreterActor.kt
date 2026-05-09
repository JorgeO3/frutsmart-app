package com.nanort.module.interpreter.internal

import android.os.Build
import com.nanort.BuildConfig
import com.nanort.core.AppAssets
import com.nanort.core.ModuleLogger
import com.nanort.core.logE
import com.nanort.core.logI
import com.nanort.core.logW
import com.nanort.module.interpreter.InterpreterSession
import com.nanort.module.interpreter.ModelId
import com.nanort.module.interpreter.ModelManager
import com.nanort.module.interpreter.NanoRTInterpreter
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.DisposableHandle
import kotlinx.coroutines.ExecutorCoroutineDispatcher
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.asCoroutineDispatcher
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.tensorflow.lite.gpu.CompatibilityList
import org.tensorflow.lite.gpu.GpuDelegate
import java.io.File
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.security.MessageDigest
import java.util.Locale
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicLong
import java.util.concurrent.atomic.AtomicReference
import kotlin.math.max
import kotlin.random.Random

internal class InterpreterActor(
  private val interpreterFactory: (Thread) -> NanoRTInterpreter = { NanoRTInterpreter(ownerThread = it) },
  private val mailboxCapacity: Int = DEFAULT_MAILBOX_CAPACITY,
  private val compat: CompatibilityList = CompatibilityList(),
  private val quarantine: GpuQuarantineStore = GpuQuarantineStore(),
  private val gpuPolicy: GpuPolicy = GpuPolicy(compat, quarantine),
  private val delegatePool: DelegatePool<GpuDelegate> = DelegatePool.gpu(capacity = 3, compat = compat),
) {
  private val tag = ModuleLogger.createTag("InterpreterActor")

  private enum class Lifecycle { NEW, STARTING, RUNNING, SHUTTING_DOWN, TERMINATED }

  private data class Runtime(
    val executor: ExecutorService,
    val dispatcher: ExecutorCoroutineDispatcher,
    val scope: CoroutineScope,
    val inbox: Channel<Msg>,
  )

  private val lifecycle = AtomicReference(Lifecycle.NEW)
  private val runtimeRef = AtomicReference<Runtime?>(null)
  private val fatalErrorRef = AtomicReference<Throwable?>(null)
  private val shutdownSignalRef = AtomicReference<CompletableDeferred<Unit>?>(null)
  private val actorThreadRef = AtomicReference<Thread?>(null)
  private val pendingReplies = AtomicInteger(0)
  private val maxPendingReplies = AtomicInteger(0)
  private val enqueuedMessages = AtomicLong(0)
  private val dequeuedMessages = AtomicLong(0)
  private val runCount = AtomicLong(0)
  private val releaseCount = AtomicLong(0)
  private val shutdownCount = AtomicLong(0)
  private val restartCount = AtomicLong(0)
  private val fatalTerminationCount = AtomicLong(0)
  private val queueWaitMsReservoir = PercentileReservoir(capacity = 4096)
  private val holdMsReservoir = PercentileReservoir(capacity = 4096)

  private lateinit var interpreter: NanoRTInterpreter
  private var state: InterpreterState = InterpreterState.UNLOADED
  private var currentModelId: ModelId? = null
  private var epoch: Long = 0L
  private var leaseSeq: Long = 0L

  private var activeDelegate: DelegatePool.Handle<GpuDelegate>? = null
  private val modelHashCache = HashMap<String, String>()

  suspend fun <T> run(modelId: ModelId, block: suspend (InterpreterSession) -> T): T {
    val runtime = startIfNeeded()
    checkNotOnActorThread("withInterpreter()")

    val callerJob = currentCoroutineContext()[Job]
    val reply = CompletableDeferred<Result<Any?>>()
    trackPendingReply(reply)

    enqueue(
      runtime,
      Msg.Run(
        modelId = modelId,
        block = block as suspend (InterpreterSession) -> Any?,
        reply = reply,
        enqueuedAtNs = System.nanoTime(),
        callerJob = callerJob
      )
    )

    @Suppress("UNCHECKED_CAST")
    return reply.await().getOrThrow() as T
  }

  suspend fun release() {
    val runtime = startIfNeeded()
    checkNotOnActorThread("releaseCurrentSession()")

    val reply = CompletableDeferred<Result<Unit>>()
    trackPendingReply(reply)
    enqueue(runtime, Msg.Release(reply, System.nanoTime()))
    reply.await().getOrThrow()
  }

  suspend fun shutdown() {
    checkNotOnActorThread("shutdown()")

    shutdownSignalRef.get()?.let { return it.await() }

    val signal = CompletableDeferred<Unit>()
    if (!shutdownSignalRef.compareAndSet(null, signal)) {
      return shutdownSignalRef.get()?.await() ?: Unit
    }

    var shutdownEnqueued = false
    try {
      val runtime = awaitRuntimeForShutdown()
      if (runtime == null) {
        signal.complete(Unit)
        shutdownSignalRef.compareAndSet(signal, null)
        return
      }

      val reply = CompletableDeferred<Result<Unit>>()
      trackPendingReply(reply)
      enqueue(runtime, Msg.Shutdown(reply, System.nanoTime()))
      shutdownEnqueued = true
      lifecycle.set(Lifecycle.SHUTTING_DOWN)
      reply.await().getOrThrow()

      signal.await()
    } catch (t: Throwable) {
      if (t is CancellationException) {
        if (!shutdownEnqueued) {
          shutdownSignalRef.compareAndSet(signal, null)
          signal.completeExceptionally(t)
        }
        throw t
      }
      if (t !is Error && lifecycle.get() == Lifecycle.SHUTTING_DOWN) {
        lifecycle.set(Lifecycle.RUNNING)
      }
      if (!shutdownEnqueued) {
        shutdownSignalRef.compareAndSet(signal, null)
      }
      signal.completeExceptionally(t)
      throw t
    }
  }

  private fun startIfNeeded(): Runtime {
    while (true) {
      when (lifecycle.get()) {
        Lifecycle.NEW -> {
          if (!lifecycle.compareAndSet(Lifecycle.NEW, Lifecycle.STARTING)) continue
          try {
            if (BuildConfig.DEBUG) {
              val startupDelayMs = ModelManagerDebugHooks.consumeStartupDelayMs()
              if (startupDelayMs > 0L) Thread.sleep(startupDelayMs)
              ModelManagerDebugHooks.consumeStartupFailure()?.let { throw it }
            }

            val runtime = createRuntime()
            runtimeRef.set(runtime)
            runtime.scope.launch { loop(runtime) }
            restartCount.incrementAndGet()
            lifecycle.set(Lifecycle.RUNNING)
            return runtime
          } catch (t: Throwable) {
            runtimeRef.set(null)
            lifecycle.compareAndSet(Lifecycle.STARTING, Lifecycle.NEW)
            if (t is Error) throw t
            throw IllegalStateException("actor_start_failed", t)
          }
        }

        Lifecycle.STARTING -> Thread.yield()
        Lifecycle.RUNNING -> return runtimeRef.get() ?: error("runtime_missing_in_running_state")
        Lifecycle.SHUTTING_DOWN -> throw IllegalStateException("actor_shutting_down")
        Lifecycle.TERMINATED -> {
          fatalErrorRef.get()?.let { throw IllegalStateException("actor_terminated", it) }
          throw IllegalStateException("actor_terminated")
        }
      }
    }
  }

  private fun createRuntime(): Runtime {
    require(mailboxCapacity > 0) { "mailbox_capacity_invalid $mailboxCapacity" }

    val executor = Executors.newSingleThreadExecutor { Thread(it, "NanoRT-Thread") }
    val dispatcher = executor.asCoroutineDispatcher()
    val scope = CoroutineScope(SupervisorJob() + dispatcher)
    val inbox = Channel<Msg>(capacity = mailboxCapacity)

    return Runtime(executor, dispatcher, scope, inbox)
  }

  private suspend fun enqueue(runtime: Runtime, msg: Msg) {
    try {
      runtime.inbox.send(msg)
      enqueuedMessages.incrementAndGet()
    } catch (t: Throwable) {
      if (t is CancellationException || t is Error) throw t
      throw IllegalStateException("actor_mailbox_send_failed", t)
    }
  }

  private fun awaitRuntimeForShutdown(maxWaitMs: Long = 3000L): Runtime? {
    val deadlineNs = System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(maxWaitMs)
    while (true) {
      val state = lifecycle.get()
      val runtime = runtimeRef.get()

      if (runtime != null) return runtime

      when (state) {
        Lifecycle.NEW -> return null
        Lifecycle.TERMINATED -> {
          val cause = fatalErrorRef.get()
          if (cause != null) throw IllegalStateException("actor_terminated", cause)
          throw IllegalStateException("actor_terminated")
        }

        Lifecycle.STARTING,
        Lifecycle.RUNNING,
        Lifecycle.SHUTTING_DOWN -> {
          if (System.nanoTime() >= deadlineNs) {
            throw IllegalStateException("actor_runtime_unavailable state=$state")
          }
          Thread.yield()
        }
      }
    }
  }

  private suspend fun loop(runtime: Runtime) {
    var fatalError: Throwable? = null
    var gracefulShutdownRequested = false

    try {
      initializeActor()

      for (msg in runtime.inbox) {
        val shouldTerminate = processMessage(runtime, msg)
        if (shouldTerminate) {
          gracefulShutdownRequested = true
          break
        }
      }
    } catch (t: Throwable) {
      if (t is CancellationException) throw t
      fatalError = t
      logE(tag, t) { "actor_loop_fatal_failure" }
    } finally {
      cleanupActor(runtime, fatalError, gracefulShutdownRequested)
    }
  }

  private fun initializeActor() {
    actorThreadRef.set(Thread.currentThread())
    delegatePool.bindToCurrentThread()
    interpreter = interpreterFactory(Thread.currentThread())
    state = InterpreterState.UNLOADED
    logI(tag) { "actor_init_ok" }
  }

  private suspend fun cleanupActor(runtime: Runtime, fatalError: Throwable?, gracefulShutdownRequested: Boolean) {
    state = InterpreterState.UNLOADED
    runtime.inbox.close(fatalError)

    drainMailbox(runtime.inbox, fatalError)
    releaseResources()

    val terminalError = if (!gracefulShutdownRequested) {
      fatalError ?: RuntimeException("actor_terminated_unexpectedly")
    } else null

    finalizeShutdown(runtime, terminalError)
  }

  private suspend fun drainMailbox(inbox: Channel<Msg>, fatalError: Throwable?) {
    try {
      val error = fatalError ?: RuntimeException("Actor terminated")
      for (msg in inbox) failMessage(msg, error)
    } catch (_: Throwable) {
    }
  }

  private fun releaseResources() {
    if (::interpreter.isInitialized) {
      try {
        interpreter.close()
      } catch (t: Throwable) {
        if (t is Error) throw t
      }
    }
    try {
      delegatePool.closeAll()
    } catch (t: Throwable) {
      if (t is Error) throw t
    }
    delegatePool.clearOwnerThread()
    actorThreadRef.set(null)
  }

  private fun finalizeShutdown(runtime: Runtime, terminalError: Throwable?) {
    runtimeRef.set(null)
    fatalErrorRef.set(terminalError)
    if (terminalError != null) {
      fatalTerminationCount.incrementAndGet()
    }
    lifecycle.set(if (terminalError != null) Lifecycle.TERMINATED else Lifecycle.NEW)

    shutdownSignalRef.getAndSet(null)?.let { signal ->
      if (!signal.isCompleted) {
        if (terminalError != null) signal.completeExceptionally(terminalError)
        else signal.complete(Unit)
      }
    }

    runtime.dispatcher.close()
    runtime.executor.shutdown()
    logI(tag) { "actor_thread_terminated" }
  }

  private suspend fun processMessage(runtime: Runtime, msg: Msg): Boolean {
    dequeuedMessages.incrementAndGet()
    val queueWaitNs = System.nanoTime() - msg.enqueuedAtNs

    try {
      return when (msg) {
        is Msg.Run -> processRunMessage(runtime, msg, queueWaitNs)
        is Msg.Release -> processReleaseMessage(msg, queueWaitNs)
        is Msg.Shutdown -> processShutdownMessage(runtime, msg, queueWaitNs)
      }
    } catch (t: Throwable) {
      handleMessageError(msg, t)
      return false
    }
  }

  private suspend fun processRunMessage(runtime: Runtime, msg: Msg.Run, queueWaitNs: Long): Boolean {
    if (BuildConfig.DEBUG) {
      ModelManagerDebugHooks.hit(ModelManagerDebugHooks.Point.AFTER_DEQUEUE, msg.modelId)
    }

    if (isCallerCancelled(msg.callerJob)) {
      msg.reply.complete(Result.failure(CancellationException("caller_cancelled_after_dequeue")))
      return false
    }

    val t0 = System.nanoTime()
    ensureModel(msg.modelId)

    if (BuildConfig.DEBUG) {
      ModelManagerDebugHooks.hit(ModelManagerDebugHooks.Point.AFTER_ENSURE_BEFORE_RUN, msg.modelId)
    }

    if (isCallerCancelled(msg.callerJob)) {
      msg.reply.complete(Result.failure(CancellationException("caller_cancelled_before_run")))
      return false
    }

    executeUserBlock(runtime, msg, t0, queueWaitNs)
    return false
  }

  private suspend fun executeUserBlock(runtime: Runtime, msg: Msg.Run, startNs: Long, queueWaitNs: Long) {
    state = InterpreterState.RUNNING
    val leaseId = ++leaseSeq

    interpreter.beginLease(epoch, msg.modelId, leaseId)

    var cancelHandle: DisposableHandle? = null
    val opJob = SupervisorJob()

    try {
      val session = SessionView(interpreter)
      val op = CoroutineScope(opJob + runtime.dispatcher)
        .async(start = CoroutineStart.UNDISPATCHED) { msg.block(session) }

      cancelHandle = msg.callerJob?.invokeOnCompletion { cause ->
        if (cause is CancellationException) {
          op.cancel(CancellationException("caller_cancelled_while_running", cause))
        }
      }

      val result = op.await()
      runCount.incrementAndGet()
      logSuccessfulRun(msg.modelId, queueWaitNs, System.nanoTime() - startNs)
      msg.reply.complete(Result.success(result))
    } catch (t: Throwable) {
      if (t is Error) {
        msg.reply.complete(Result.failure(t))
        throw t
      }
      logE(tag, t) { "actor_msg_fail kind=Run" }
      msg.reply.complete(Result.failure(t))
    } finally {
      cancelHandle?.dispose()
      opJob.cancel()
      interpreter.endLease(leaseId)
      state = InterpreterState.READY
    }
  }

  private fun processReleaseMessage(msg: Msg.Release, queueWaitNs: Long): Boolean {
    val t0 = System.nanoTime()
    releaseCurrent()
    releaseCount.incrementAndGet()
    logI(tag) { formatLog("actor_release_ok", queueWaitNs, System.nanoTime() - t0) }
    msg.reply.complete(Result.success(Unit))
    return false
  }

  private fun processShutdownMessage(runtime: Runtime, msg: Msg.Shutdown, queueWaitNs: Long): Boolean {
    val t0 = System.nanoTime()
    shutdownAll()
    shutdownCount.incrementAndGet()
    logI(tag) { formatLog("actor_shutdown_ok", queueWaitNs, System.nanoTime() - t0) }
    msg.reply.complete(Result.success(Unit))
    runtime.inbox.close()
    return true
  }

  private fun handleMessageError(msg: Msg, t: Throwable) {
    if (t is CancellationException) throw t
    if (t is Error) {
      failMessage(msg, t)
      throw t
    }
    logE(tag, t) { "actor_msg_fail kind=${msg::class.simpleName}" }
    failMessage(msg, t)
  }

  private fun failMessage(msg: Msg, cause: Throwable) {
    when (msg) {
      is Msg.Run -> msg.reply.complete(Result.failure(cause))
      is Msg.Release -> msg.reply.complete(Result.failure(cause))
      is Msg.Shutdown -> msg.reply.complete(Result.failure(cause))
    }
  }

  private suspend fun ensureModel(modelId: ModelId) {
    if (currentModelId == modelId && state == InterpreterState.READY && interpreter.isLoaded()) return

    logI(tag) { "ensure_model_begin ${kv("model" to modelId.name)}" }
    val modelFile = getModelFile(modelId)
    logI(tag) { "ensure_model_after_get_file ${kv("model" to modelId.name, "path" to modelFile.name, "sizeB" to modelFile.length())}" }
    val modelHash = getModelHash(modelFile)
    logI(tag) { "ensure_model_after_hash ${kv("model" to modelId.name, "hashPrefix" to modelHash.take(12))}" }
    val tryGpu = gpuPolicy.shouldUseGpu(modelId)
    logI(tag) { "ensure_model_after_gpu_policy ${kv("model" to modelId.name, "tryGpu" to tryGpu)}" }

    if (tryGpu) {
      tryLoadWithGpuFallback(modelId, modelFile, modelHash)
    } else {
      switchModel(modelId, modelFile, modelHash, useGpu = false)
    }
  }

  private suspend fun tryLoadWithGpuFallback(modelId: ModelId, modelFile: File, modelHash: String) {
    try {
      switchModel(modelId, modelFile, modelHash, useGpu = true)
    } catch (t: Throwable) {
      if (t is Error) throw t

      val isIoError = t is ModelManager.IoException || t is NanoRTInterpreter.IoException
      if (isIoError) throw t

      gpuPolicy.quarantine(modelId, reasonFrom(t))
      logW(tag) { "gpu_fallback_to_cpu ${kv("model" to modelId.name, "reason" to reasonFrom(t))}" }
      switchModel(modelId, modelFile, modelHash, useGpu = false)
    }
  }

  private suspend fun switchModel(modelId: ModelId, modelFile: File, modelHash: String, useGpu: Boolean) {
    logI(tag) { "model_switch ${kv("from" to (currentModelId?.name ?: "none"), "to" to modelId.name, "gpu" to useGpu)}" }

    state = InterpreterState.RELEASING
    epoch++

    interpreter.releaseCurrentResources()
    activeDelegate?.let { delegatePool.release(it) }
    activeDelegate = null
    currentModelId = null

    if (BuildConfig.DEBUG) {
      ModelManagerDebugHooks.hit(ModelManagerDebugHooks.Point.AFTER_RELEASE_BEFORE_DELEGATE, modelId)
    }

    val delegateHandle = if (useGpu) acquireGpuDelegate(modelId, modelHash) else null

    loadModelWithDelegate(modelId, modelFile, delegateHandle)
  }

  private fun acquireGpuDelegate(modelId: ModelId, modelHash: String): DelegatePool.Handle<GpuDelegate> {
    val token = buildSerializationToken(modelHash)
    return try {
      delegatePool.acquire(modelId, token)
    } catch (t: Throwable) {
      if (t is Error) throw t
      throw ModelManager.DelegateException("Fallo creando GpuDelegate para ${modelId.name}", t)
    }
  }

  private suspend fun loadModelWithDelegate(
    modelId: ModelId,
    modelFile: File,
    delegateHandle: DelegatePool.Handle<GpuDelegate>?
  ) {
    state = InterpreterState.LOADING
    try {
      interpreter.loadModel(modelFile, delegateHandle?.delegate)
      activeDelegate = delegateHandle
      currentModelId = modelId
      state = InterpreterState.READY
      logI(tag) { "model_ready ${kv("model" to modelId.name, "gpu" to (delegateHandle != null), "epoch" to epoch)}" }
    } catch (t: Throwable) {
      if (t is Error) throw t
      delegateHandle?.let { delegatePool.release(it) }
      state = InterpreterState.UNLOADED
      throw ModelManager.ModelLoadException("Fallo cargando modelo ${modelId.name}", t)
    }
  }

  private fun releaseCurrent() {
    if (currentModelId == null && activeDelegate == null) {
      logI(tag) { "session_release_skip reason=no_current_model" }
      return
    }

    state = InterpreterState.RELEASING
    epoch++

    interpreter.releaseCurrentResources()
    activeDelegate?.let { delegatePool.release(it) }
    activeDelegate = null
    currentModelId = null

    state = InterpreterState.UNLOADED
  }

  private fun shutdownAll() {
    state = InterpreterState.RELEASING
    epoch++

    interpreter.close()
    activeDelegate?.let { delegatePool.release(it) }
    activeDelegate = null
    currentModelId = null

    delegatePool.closeAll()
    state = InterpreterState.UNLOADED
  }

  private fun getModelFile(modelId: ModelId): File {
    val path = AppAssets.getAssetPath(modelId.fileName)
    require(path.isNotBlank()) { "asset_path_blank model=${modelId.name}" }

    val file = File(path)
    require(file.exists() && file.isFile) { "model_file_invalid path=${file.absolutePath}" }
    require(file.length() > 0) { "model_file_empty path=${file.absolutePath}" }

    return file
  }

  private suspend fun getModelHash(modelFile: File): String {
    val path = modelFile.absolutePath
    modelHashCache[path]?.let { return it }

    // Compute the model hash on the actor thread instead of Dispatchers.IO.
    // On app startup, Skybolt/WorkManager can heavily saturate Dispatchers.IO with
    // upload reads, SAS requests and persistence, which starves NanoRT warmup right
    // after `ensure_model_after_get_file`. The model file is small (~11 MB), so the
    // dedicated actor thread is a better place for this deterministic one-off read.
    val hash = computeFileHash(modelFile)
    assertOnActorThread("model_hash_cache_put")
    modelHashCache[path] = hash
    return hash
  }

  private fun computeFileHash(file: File): String {
    val digest = MessageDigest.getInstance("SHA-256")
    val buffer = ByteArray(8192)

    file.inputStream().use { stream ->
      while (true) {
        val bytesRead = stream.read(buffer)
        if (bytesRead <= 0) break
        digest.update(buffer, 0, bytesRead)
      }
    }

    return digest.digest().joinToString("") { "%02x".format(it) }
  }

  private fun buildSerializationToken(modelHash: String): String {
    val raw = "$modelHash|${Build.FINGERPRINT}|${Build.VERSION.SDK_INT}|" +
        "mod=nano-rt|ser=${InferenceFlags.gpuSerializationEnabled}"
    return sha256(raw)
  }

  private fun sha256(input: String): String {
    val digest = MessageDigest.getInstance("SHA-256").digest(input.toByteArray())
    return digest.joinToString("") { "%02x".format(it) }
  }

  private fun isOnActorThread(): Boolean =
    actorThreadRef.get()?.let { Thread.currentThread() === it } == true

  private fun checkNotOnActorThread(op: String) {
    if (isOnActorThread()) {
      throw IllegalStateException("reentrancy_forbidden: $op llamado desde actor-thread")
    }
  }

  private fun assertOnActorThread(op: String) {
    val owner = actorThreadRef.get()
    check(owner != null && Thread.currentThread() === owner) {
      "actor_thread_required op=$op expected=${owner?.name} actual=${Thread.currentThread().name}"
    }
  }

  private fun isCallerCancelled(job: Job?): Boolean = job?.isCancelled == true

  private fun reasonFrom(t: Throwable): String =
    (t.message ?: t::class.java.simpleName).take(160)

  private fun kv(vararg pairs: Pair<String, Any?>) =
    pairs.joinToString(" ") { (k, v) -> "$k=$v" }

  private fun formatLog(prefix: String, queueWaitNs: Long, holdNs: Long) =
    "$prefix ${kv(
      "queueWaitMs" to String.format(Locale.US, "%.3f", queueWaitNs / 1e6),
      "holdMs" to String.format(Locale.US, "%.3f", holdNs / 1e6),
      "epoch" to epoch
    )}"

  private fun logSuccessfulRun(modelId: ModelId, queueWaitNs: Long, holdNs: Long) {
    queueWaitMsReservoir.add(queueWaitNs / 1e6)
    holdMsReservoir.add(holdNs / 1e6)
    logI(tag) {
      "actor_run_ok ${kv(
        "model" to modelId.name,
        "queueWaitMs" to String.format(Locale.US, "%.3f", queueWaitNs / 1e6),
        "holdMs" to String.format(Locale.US, "%.3f", holdNs / 1e6),
        "epoch" to epoch,
        "gpu" to (activeDelegate != null)
      )}"
    }
  }

  private fun trackPendingReply(reply: CompletableDeferred<*>) {
    val current = pendingReplies.incrementAndGet()
    maxPendingReplies.getAndUpdate { prev -> max(prev, current) }
    reply.invokeOnCompletion {
      pendingReplies.decrementAndGet()
    }
  }

  private class SessionView(
    private val interpreter: NanoRTInterpreter,
  ) : InterpreterSession {
    private var inputScratch: ByteBuffer? = null

    override fun getInputBuffer(): ByteBuffer {
      val existing = inputScratch
      if (existing != null) {
        existing.rewind()
        return existing.duplicate().order(ByteOrder.nativeOrder())
      }

      val source = interpreter.getInputBuffer()
      val scratch = ByteBuffer.allocateDirect(source.capacity()).order(ByteOrder.nativeOrder())
      inputScratch = scratch
      scratch.rewind()
      return scratch.duplicate().order(ByteOrder.nativeOrder())
    }

    override fun runInference() {
      val scratch = inputScratch
      if (scratch != null) {
        val internal = interpreter.getInputBuffer()
        val src = scratch.duplicate().order(ByteOrder.nativeOrder())
        src.rewind()
        internal.rewind()
        internal.put(src)
        internal.rewind()
      }
      interpreter.runInference()
    }

    override fun getOutputBuffers(): Map<Int, ByteBuffer> {
      val outputs = interpreter.getOutputBuffers()
      return outputs.mapValues { (_, value) ->
        val src = value.duplicate().order(ByteOrder.nativeOrder())
        src.rewind()
        val copy = ByteBuffer.allocateDirect(src.capacity()).order(ByteOrder.nativeOrder())
        copy.put(src)
        copy.rewind()
        copy.asReadOnlyBuffer().order(ByteOrder.nativeOrder())
      }
    }

    override fun getInputTensorShape() = interpreter.getInputTensorShape()
    override fun getOutputTensorShapes() = interpreter.getOutputTensorShapes()
  }

  internal fun lifecycleNameForTests(): String = lifecycle.get().name

  internal fun hasRuntimeForTests(): Boolean = runtimeRef.get() != null

  internal fun debugSnapshotForSoak(): DebugSnapshot {
    val runtime = runtimeRef.get()
    val job = runtime?.scope?.coroutineContext?.get(Job)
    val childJobCount = job?.children?.count() ?: 0
    val mailboxDepth = max(0L, enqueuedMessages.get() - dequeuedMessages.get())

    return DebugSnapshot(
      lifecycle = lifecycle.get().name,
      interpreterState = runCatching { state.name }.getOrDefault("unknown"),
      currentModel = currentModelId?.name,
      epoch = epoch,
      ownerThreadName = actorThreadRef.get()?.name,
      runtimePresent = runtime != null,
      shutdownInProgress = shutdownSignalRef.get() != null,
      pendingReplies = pendingReplies.get(),
      maxPendingReplies = maxPendingReplies.get(),
      approxMailboxDepth = mailboxDepth,
      enqueuedMessages = enqueuedMessages.get(),
      dequeuedMessages = dequeuedMessages.get(),
      runCount = runCount.get(),
      releaseCount = releaseCount.get(),
      shutdownCount = shutdownCount.get(),
      restartCount = restartCount.get(),
      fatalTerminationCount = fatalTerminationCount.get(),
      childJobCount = childJobCount,
      gpuDelegateActive = activeDelegate != null,
      queueWaitMs = queueWaitMsReservoir.snapshot(),
      holdMs = holdMsReservoir.snapshot(),
      fatalError = fatalErrorRef.get()?.let { "${it::class.java.simpleName}: ${it.message}" },
    )
  }

  internal data class DebugSnapshot(
    val lifecycle: String,
    val interpreterState: String,
    val currentModel: String?,
    val epoch: Long,
    val ownerThreadName: String?,
    val runtimePresent: Boolean,
    val shutdownInProgress: Boolean,
    val pendingReplies: Int,
    val maxPendingReplies: Int,
    val approxMailboxDepth: Long,
    val enqueuedMessages: Long,
    val dequeuedMessages: Long,
    val runCount: Long,
    val releaseCount: Long,
    val shutdownCount: Long,
    val restartCount: Long,
    val fatalTerminationCount: Long,
    val childJobCount: Int,
    val gpuDelegateActive: Boolean,
    val queueWaitMs: Stats,
    val holdMs: Stats,
    val fatalError: String?,
  )

  internal data class Stats(
    val samples: Long,
    val min: Double,
    val p50: Double,
    val p95: Double,
    val p99: Double,
    val max: Double,
  )

  private class PercentileReservoir(private val capacity: Int) {
    private val lock = Any()
    private val values = ArrayList<Double>(capacity)
    private var seen: Long = 0L

    fun add(value: Double) {
      synchronized(lock) {
        seen += 1
        if (values.size < capacity) {
          values.add(value)
          return
        }
        val idx = Random.nextLong(seen)
        if (idx < capacity) {
          values[idx.toInt()] = value
        }
      }
    }

    fun snapshot(): Stats {
      synchronized(lock) {
        if (values.isEmpty()) {
          return Stats(samples = 0, min = 0.0, p50 = 0.0, p95 = 0.0, p99 = 0.0, max = 0.0)
        }
        val sorted = values.sorted()
        return Stats(
          samples = seen,
          min = sorted.first(),
          p50 = percentile(sorted, 0.50),
          p95 = percentile(sorted, 0.95),
          p99 = percentile(sorted, 0.99),
          max = sorted.last(),
        )
      }
    }

    private fun percentile(sorted: List<Double>, q: Double): Double {
      val idx = ((sorted.size - 1) * q).toInt().coerceIn(0, sorted.size - 1)
      return sorted[idx]
    }
  }

  companion object {
    private const val DEFAULT_MAILBOX_CAPACITY = 64
  }
}
