package com.nanort.module.interpreter

import com.nanort.core.ModuleLogger
import com.nanort.core.logE
import com.nanort.core.logI
import com.nanort.core.logW
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.tensorflow.lite.InterpreterApi
import org.tensorflow.lite.gpu.GpuDelegate
import java.io.Closeable
import java.io.File
import java.io.FileInputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.channels.ReadableByteChannel
import java.util.Locale
import java.util.concurrent.atomic.AtomicBoolean

class NanoRTInterpreter(
  private val ownerThread: Thread,
  private var interpreter: InterpreterApi? = null,
  private val engineFactory: (ByteBuffer, InterpreterApi.Options) -> InterpreterApi =
    { modelBuffer, options -> InterpreterApi.create(modelBuffer, options) },
) : Closeable, InterpreterSession {

  sealed class NanoRTException(message: String, cause: Throwable? = null) : RuntimeException(message, cause)
  class ModelLoadException(message: String, cause: Throwable? = null) : NanoRTException(message, cause)
  class InferenceException(message: String, cause: Throwable? = null) : NanoRTException(message, cause)
  class IoException(message: String, cause: Throwable? = null) : NanoRTException(message, cause)

  companion object {
    private val TAG = ModuleLogger.createTag("NanoRTInterpreter")
    private const val CPU_FALLBACK_THREADS = 4
  }

  private var leaseActive: Boolean = false
  private var leaseEpoch: Long = -1L
  private var leaseId: Long = -1L
  private var leaseModel: ModelId? = null

  private val closeStarted = AtomicBoolean(false)

  private var inputBuffer: ByteBuffer? = null
  private val outputBuffers = mutableMapOf<Int, ByteBuffer>()
  private val outputsMap = HashMap<Int, Any>()

  private fun kv(vararg pairs: Pair<String, Any?>): String =
    pairs.joinToString(" ") { (k, v) -> "$k=$v" }

  private fun assertOnOwnerThread() {
    check(Thread.currentThread() === ownerThread) {
      "thread_violation expected=${ownerThread.name} actual=${Thread.currentThread().name}"
    }
  }

  private fun assertLeaseValid() {
    check(leaseActive) { "lease_violation: no_active_lease" }
  }

  private fun assertNoActiveLease(op: String) {
    check(!leaseActive) { "lease_active_forbidden op=$op" }
  }

  internal fun beginLease(epoch: Long, modelId: ModelId, leaseId: Long) {
    assertOnOwnerThread()
    check(!leaseActive) {
      "lease_violation: already_active epoch=${this.leaseEpoch} lease=${this.leaseId} model=${leaseModel?.name}"
    }
    this.leaseActive = true
    this.leaseEpoch = epoch
    this.leaseId = leaseId
    this.leaseModel = modelId
  }

  internal fun endLease(leaseId: Long) {
    assertOnOwnerThread()
    check(this.leaseId == leaseId) {
      "lease_mismatch expected=${this.leaseId} actual=$leaseId model=${leaseModel?.name}"
    }
    this.leaseActive = false
    this.leaseEpoch = -1L
    this.leaseId = -1L
    this.leaseModel = null
  }

  suspend fun loadModel(modelFile: File, gpuDelegate: GpuDelegate?) {
    assertOnOwnerThread()
    assertNoActiveLease("loadModel")

    require(modelFile.exists() && modelFile.isFile) { "model_file_invalid path=${modelFile.absolutePath}" }
    require(modelFile.length() > 0L) { "model_file_empty path=${modelFile.absolutePath}" }

    logI(TAG) {
      "model_load_begin " + kv(
        "file" to modelFile.name,
        "sizeB" to modelFile.length()
      )
    }

    releaseCurrentResources()

    val modelBuffer: ByteBuffer = try {
      withContext(Dispatchers.IO) { loadModelFile(modelFile) }
    } catch (t: Throwable) {
      if (t is Error) throw t
      logE(TAG, t) { "model_file_load_error " + kv("file" to modelFile.name) }
      throw IoException("Fallo leyendo el archivo del modelo: ${modelFile.name}", t)
    }

    val options = InterpreterApi.Options().apply {
      setRuntime(InterpreterApi.Options.TfLiteRuntime.FROM_APPLICATION_ONLY)
      setUseXNNPACK(true)
      if (gpuDelegate != null) {
        addDelegate(gpuDelegate)
        logI(TAG) { "delegate_apply " + kv("kind" to "GPU", "external" to true) }
      } else {
        setNumThreads(CPU_FALLBACK_THREADS)
        logI(TAG) {
          "delegate_apply " + kv(
            "kind" to "CPU",
            "threads" to CPU_FALLBACK_THREADS,
            "xnnpack" to true
          )
        }
      }
    }

    try {
      interpreter = engineFactory(modelBuffer, options)
      allocateOptimizedBuffers()
      rebuildOutputsMap()
      sanityCheckOutputMapping()
      logI(TAG) { "model_load_ok " + kv("file" to modelFile.name) }
    } catch (t: Throwable) {
      if (t is Error) throw t
      logE(TAG, t) { "model_load_fail " + kv("file" to modelFile.name) }
      releaseCurrentResources()
      throw ModelLoadException("Fallo creando o preparando el intérprete para ${modelFile.name}", t)
    }
  }

  override fun runInference() {
    assertOnOwnerThread()
    assertLeaseValid()

    val currentInterpreter = interpreter ?: throw InferenceException("Interpreter no cargado. Llama a loadModel() primero.")
    val inBuf = inputBuffer ?: throw InferenceException("inputBuffer nulo. allocateOptimizedBuffers() no fue ejecutado.")

    inBuf.rewind()
    outputBuffers.values.forEach { it.rewind() }

    try {
      sanityCheckOutputMapping()
    } catch (t: Throwable) {
      if (t is Error) throw t
      throw InferenceException("outputsMap incompleto o inválido", t)
    }

    val startNs = System.nanoTime()
    try {
      val inputsArray = arrayOf(inBuf as Any)
      currentInterpreter.runForMultipleInputsOutputs(inputsArray, outputsMap)
      val durMs = (System.nanoTime() - startNs) / 1_000_000.0
      logI(TAG) {
        "inference_ok " + kv(
          "ms" to String.format(
            Locale.US,
            "%.3f",
            durMs
          ), "outs" to outputsMap.size
        )
      }
    } catch (t: Throwable) {
      if (t is CancellationException) throw t
      if (t is Error) throw t
      val durMs = (System.nanoTime() - startNs) / 1_000_000.0
      logE(TAG, t) {
        "inference_fail " + kv(
          "ms" to String.format(
            Locale.US,
            "%.3f",
            durMs
          )
        )
      }
      throw InferenceException("Inferencia falló tras ${String.format(Locale.US, "%.3f", durMs)} ms", t)
    }
  }

  fun releaseCurrentResources() {
    assertOnOwnerThread()
    assertNoActiveLease("releaseCurrentResources")
    try {
      interpreter?.close()
    } catch (t: Throwable) {
      if (t is Error) throw t
      logW(TAG, t) { "interpreter_close_error" }
    } finally {
      interpreter = null
    }
    inputBuffer = null
    outputBuffers.clear()
    outputsMap.clear()
    logI(TAG) { "resources_released" }
  }

  override fun getInputBuffer(): ByteBuffer {
    assertOnOwnerThread()
    assertLeaseValid()
    val buffer = inputBuffer ?: throw IllegalStateException("Buffer de entrada no disponible")
    return buffer.duplicate().order(ByteOrder.nativeOrder())
  }

  override fun getOutputBuffers(): Map<Int, ByteBuffer> {
    assertOnOwnerThread()
    assertLeaseValid()
    return outputBuffers.mapValues { (_, value) ->
      value.asReadOnlyBuffer().order(ByteOrder.nativeOrder())
    }
  }

  override fun getOutputTensorShapes(): List<IntArray> {
    assertOnOwnerThread()
    assertLeaseValid()
    val intr = interpreter ?: throw IllegalStateException("Intérprete no cargado")
    return (0 until intr.outputTensorCount).map { intr.getOutputTensor(it).shape().clone() }
  }

  override fun getInputTensorShape(): IntArray? {
    assertOnOwnerThread()
    assertLeaseValid()
    return interpreter?.getInputTensor(0)?.shape()?.clone()
  }

  override fun close() {
    assertOnOwnerThread()
    assertNoActiveLease("close")
    if (!closeStarted.compareAndSet(false, true)) {
      logI(TAG) { "close_skip_already_started" }
      return
    }
    releaseCurrentResources()
    logI(TAG) { "close_end" }
  }

  internal fun isLoaded(): Boolean {
    val intr = interpreter ?: return false
    return inputBuffer != null && outputBuffers.isNotEmpty() && outputsMap.isNotEmpty() && outputsMap.size == outputBuffers.size && intr.outputTensorCount == outputBuffers.size
  }

  private fun allocateOptimizedBuffers() {
    val intr = interpreter ?: return
    logI(TAG) { "buffers_alloc_begin" }

    try {
      val inputTensor = intr.getInputTensor(0)
      inputBuffer = ByteBuffer.allocateDirect(inputTensor.numBytes()).order(ByteOrder.nativeOrder())

      outputBuffers.clear()
      for (i in 0 until intr.outputTensorCount) {
        val outTensor = intr.getOutputTensor(i)
        outputBuffers[i] = ByteBuffer.allocateDirect(outTensor.numBytes()).order(ByteOrder.nativeOrder())
      }

      logI(TAG) {
        "buffers_alloc_ok " + kv(
          "in.bytes" to inputTensor.numBytes(),
          "outs" to intr.outputTensorCount,
          "outs.bytes" to outputBuffers.values.sumOf { it.capacity() }
        )
      }
    } catch (t: Throwable) {
      if (t is Error) throw t
      inputBuffer = null
      outputBuffers.clear()
      outputsMap.clear()
      logE(TAG, t) { "buffers_alloc_fail" }
      throw ModelLoadException("Fallo asignando buffers de entrada/salida", t)
    }
  }

  private fun rebuildOutputsMap() {
    outputsMap.clear()
    for ((idx, buf) in outputBuffers) outputsMap[idx] = buf
  }

  private fun sanityCheckOutputMapping() {
    val intr = interpreter ?: return
    val expected = intr.outputTensorCount
    check(outputsMap.size == expected) {
      "outputs_map_mismatch " + kv("expected" to expected, "actual" to outputsMap.size)
    }
  }

  private fun loadModelFile(file: File): ByteBuffer {
    return try {
      FileInputStream(file).use { fis ->
        val channel = fis.channel
        val size = channel.size()
        require(size > 0 && size <= Int.MAX_VALUE) { "model_file_size_invalid size=$size" }

        val buffer = ByteBuffer.allocateDirect(size.toInt()).order(ByteOrder.nativeOrder())
        val read = readFully(channel, buffer).toLong()
        check(read == size) { "model_file_read_incomplete expected=$size read=$read" }
        buffer.flip()
        buffer
      }
    } catch (t: Throwable) {
      if (t is Error) throw t
      throw IoException("Fallo leyendo el archivo del modelo desde disco", t)
    }
  }

  internal fun readFully(channel: ReadableByteChannel, buffer: ByteBuffer): Int {
    var total = 0
    var zeroReads = 0
    val maxZeroReads = 32
    while (buffer.hasRemaining()) {
      val n = channel.read(buffer)
      if (n < 0) break
      if (n == 0) {
        zeroReads += 1
        if (zeroReads > maxZeroReads) {
          throw IllegalStateException("read_fully_stalled zeroReads=$zeroReads")
        }
        Thread.yield()
        continue
      }
      zeroReads = 0
      total += n
    }
    return total
  }
}
