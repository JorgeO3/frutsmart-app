package expo.modules.nanort.module.interpreter

import expo.modules.nanort.core.ModuleLogger
import expo.modules.nanort.core.logE
import expo.modules.nanort.core.logI
import expo.modules.nanort.core.logW
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.asCoroutineDispatcher
import kotlinx.coroutines.withContext
import org.tensorflow.lite.InterpreterApi
import org.tensorflow.lite.InterpreterApi.Options.TfLiteRuntime
import org.tensorflow.lite.gpu.GpuDelegate
import java.io.Closeable
import java.io.File
import java.io.FileInputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.Locale
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit


/**
 * Intérprete TensorFlow Lite optimizado para alto rendimiento.
 *
 * - Selección automática entre GPU y CPU.
 * - Ejecución serializada en un hilo dedicado.
 * - IO buffers preasignados y mapeados correctamente a salidas.
 */
class NanoRTInterpreter : Closeable {

  sealed class NanoRTException(message: String, cause: Throwable? = null) : RuntimeException(message, cause)
  class ModelLoadException(message: String, cause: Throwable? = null) : NanoRTException(message, cause)
  class InferenceException(message: String, cause: Throwable? = null) : NanoRTException(message, cause)
  class IoException(message: String, cause: Throwable? = null) : NanoRTException(message, cause)
  class ResourceReleaseException(message: String, cause: Throwable? = null) : NanoRTException(message, cause)

  companion object {
    private val TAG = ModuleLogger.createTag("NanoRTInterpreter")
    private const val CPU_FALLBACK_THREADS = 4
    private const val SHUTDOWN_TIMEOUT_SECONDS = 5L
  }

  // --- Estado principal ---
  private var interpreter: InterpreterApi? = null

  // --- Concurrencia ---
  @Volatile private var executor: ExecutorService? = newExecutor()
  @Volatile private var dispatcher: CoroutineDispatcher = requireNotNull(executor).asCoroutineDispatcher() // CAMBIO

  // CAMBIO: factoría centralizada para crear el hilo dedicado
  private fun newExecutor(): ExecutorService = Executors.newSingleThreadExecutor { r ->
    Thread(r, "NanoRT-Thread")
  } // CAMBIO

  // CAMBIO: garantiza que el executor/dispatcher estén vivos antes de usarlos
  @Synchronized
  private fun ensureExecutorAlive() {
    val ex = executor
    if (ex == null || ex.isShutdown || ex.isTerminated) {
      val newEx = newExecutor()
      executor = newEx
      dispatcher = newEx.asCoroutineDispatcher()
      // CAMBIO: quitar el cast a ThreadPoolExecutor del log
      logI(TAG) { "executor_revived name=NanoRT-Thread" }
    }
  }

  internal val modelDispatcher: CoroutineDispatcher
    get() {
      ensureExecutorAlive()
      return dispatcher
    }
  
  fun isExecutorAlive(): Boolean = executor?.let { !it.isShutdown && !it.isTerminated } == true // CAMBIO

  // --- Buffers IO ---
  private var inputBuffer: ByteBuffer? = null
  private val outputBuffers = mutableMapOf<Int, ByteBuffer>()
  private val outputsMap = HashMap<Int, Any>()   // <- lo que TFLite usará para escribir

  // ===============================================================================================
  // Loggin Helpers
  // ===============================================================================================

  private fun kv(vararg pairs: Pair<String, Any?>): String =
    pairs.joinToString(" ") { (k, v) -> "$k=$v" }

  private fun logTensorMeta(intr: InterpreterApi) {
    val in0 = intr.getInputTensor(0)
    val outCount = intr.outputTensorCount
    val outBytes = (0 until outCount).sumOf { intr.getOutputTensor(it).numBytes() }
    logI(TAG) {
      "tensor_meta " + kv(
        "in.shape" to in0.shape().contentToString(),
        "in.bytes" to in0.numBytes(),
        "outs" to outCount,
        "outs.bytes" to outBytes
      )
    }
  }

  // ===============================================================================================
  // Gestión de modelo (ejecutar en modelDispatcher)
  // ===============================================================================================

  fun loadModel(modelFile: File, gpuDelegate: GpuDelegate?) {
    require(modelFile.exists() && modelFile.isFile) {
      "model_file_invalid " + kv(
        "path" to modelFile.absolutePath,
        "exists" to modelFile.exists(),
        "isFile" to modelFile.isFile
      )
    }
    require(modelFile.length() > 0L) {
      "model_file_empty " + kv("path" to modelFile.absolutePath, "sizeB" to 0)
    }

    logI(TAG) { "model_load_begin " + kv("file" to modelFile.name, "sizeB" to modelFile.length(), "thread" to Thread.currentThread().name) }

    releaseCurrentResources()

    val modelBuffer: ByteBuffer = try {
      loadModelFile(modelFile)
    } catch (t: Throwable) {
      logE(TAG, t) { "model_file_load_error " + kv("file" to modelFile.name) }
      throw IoException("Fallo leyendo el archivo del modelo: ${modelFile.name}", t)
    }

    val options = InterpreterApi.Options().apply {
      setRuntime(TfLiteRuntime.FROM_APPLICATION_ONLY)
      setUseXNNPACK(true)
      if (gpuDelegate != null) {
        addDelegate(gpuDelegate)
        logI(TAG) { "delegate_apply " + kv("kind" to "GPU", "external" to true) }
      } else {
        setNumThreads(CPU_FALLBACK_THREADS)
        logI(TAG) { "delegate_apply " + kv("kind" to "CPU", "threads" to CPU_FALLBACK_THREADS, "xnnpack" to true) }
      }
    }

    try {
      interpreter = InterpreterApi.create(modelBuffer, options)
      allocateOptimizedBuffers()        // asigna input/output buffers
      rebuildOutputsMap()               // <--- ENSAMBLA el Map que TFLite realmente usa
      sanityCheckOutputMapping()        // aserción útil en desarrollo

      interpreter?.let { logTensorMeta(it) }
      logI(TAG) { "model_load_ok " + kv("file" to modelFile.name) }
    } catch (t: Throwable) {
      // Si la creación del intérprete o la asignación fallan, limpíamos y propagamos
      logE(TAG, t) { "model_load_fail " + kv("file" to modelFile.name) }
      releaseCurrentResources() // best-effort para no dejar recursos colgados si algo falló a mitad
      throw ModelLoadException("Fallo creando o preparando el intérprete para ${modelFile.name}", t)
    }
  }

  suspend fun runInference() = withContext(modelDispatcher) {
    val currentInterpreter = try {
      checkNotNull(interpreter) { "Interpreter no cargado. Llama a loadModel() primero." }
    } catch (iae: IllegalStateException) {
      throw InferenceException(iae.message ?: "Interpreter no cargado.", iae)
    }

    val inBuf = try {
      checkNotNull(inputBuffer) { "inputBuffer nulo. allocateOptimizedBuffers() no fue ejecutado." }
    } catch (iae: IllegalStateException) {
      throw InferenceException(iae.message ?: "Buffer de entrada no disponible.", iae)
    }

    // Prepara buffers para inferencia
    inBuf.rewind()
    outputBuffers.values.forEach { it.rewind() }

    // (defensivo) asegúrate de que outputsMap tenga todas las salidas
    try {
      sanityCheckOutputMapping()
    } catch (t: Throwable) {
      throw InferenceException("outputsMap incompleto o inválido", t)
    }

    val startNs = System.nanoTime()
    try {
      val inputsArray = arrayOf(inBuf as Any)
      currentInterpreter.runForMultipleInputsOutputs(inputsArray, outputsMap)
      val durMs = (System.nanoTime() - startNs) / 1_000_000.0
      logI(TAG) { "inference_ok " + kv("ms" to String.format(Locale.US, "%.3f", durMs), "outs" to outputsMap.size) }
    } catch (t: Throwable) {
      val durMs = (System.nanoTime() - startNs) / 1_000_000.0
      logE(TAG, t) { "inference_fail " + kv("ms" to String.format(Locale.US, "%.3f", durMs)) }
      throw InferenceException("Inferencia falló tras ${String.format("%.3f", durMs)} ms", t)
    }
  }

  fun releaseCurrentResources() {
    try {
      interpreter?.close()
    } catch (t: Throwable) {
      logW(TAG, t) { "interpreter_close_error" }
    } finally {
      interpreter = null
    }
    inputBuffer = null
    outputBuffers.clear()
    outputsMap.clear()
    logI(TAG) { "resources_released" }
  }

  // ===============================================================================================
  // Acceso a datos (ejecutar en modelDispatcher)
  // ===============================================================================================

  fun getInputBuffer(): ByteBuffer =
    inputBuffer ?: throw IllegalStateException("Buffer de entrada no disponible")

  fun getOutputBuffers(): Map<Int, ByteBuffer> = outputBuffers

  fun getOutputTensorShapes(): List<IntArray> {
    val intr = interpreter ?: throw IllegalStateException("Intérprete no cargado")
    return (0 until intr.outputTensorCount).map { intr.getOutputTensor(it).shape().clone() }
  }

  fun getInputTensorShape(): IntArray? =
    interpreter?.getInputTensor(0)?.shape()?.clone()

  // ===============================================================================================
  // Ciclo de vida / cierre
  // ===============================================================================================

  override fun close() {
    logI(TAG) { "close_begin thread=${Thread.currentThread().name}" }
    // CAMBIO: usa snapshot del executor, puede ser nulo si ya se cerró
    val ex = executor // CAMBIO
    if (ex != null && !ex.isShutdown) { // CAMBIO
      try {
        ex.submit {
          try { releaseCurrentResources() } catch (t: Throwable) { logW(TAG, t) { "release_during_close_error" } }
        }.get(SHUTDOWN_TIMEOUT_SECONDS, TimeUnit.SECONDS)
      } catch (t: Throwable) {
        logW(TAG, t) { "close_timeout_or_error timeoutSec=$SHUTDOWN_TIMEOUT_SECONDS" }
      } finally {
        ex.shutdown()
      }
    }
    // CAMBIO: marca objeto como “apagado” para forzar revive en el siguiente uso
    executor = null // CAMBIO
    // Nota: dispatcher se actualiza al próximo acceso vía ensureExecutorAlive()
    logI(TAG) { "close_end" }
  }

  // ===============================================================================================
  // Buffers
  // ===============================================================================================

  private fun allocateOptimizedBuffers() {
    val intr = interpreter ?: return
    logI(TAG) { "buffers_alloc_begin" }

    try {
      // Buffer de entrada
      val inputTensor = intr.getInputTensor(0)
      inputBuffer = ByteBuffer
        .allocateDirect(inputTensor.numBytes())
        .order(ByteOrder.nativeOrder())

      // Buffers de salida
      outputBuffers.clear()
      for (i in 0 until intr.outputTensorCount) {
        val outTensor = intr.getOutputTensor(i)
        outputBuffers[i] = ByteBuffer
          .allocateDirect(outTensor.numBytes())
          .order(ByteOrder.nativeOrder())
      }

      logI(TAG) {
        "buffers_alloc_ok " + kv(
          "in.bytes" to inputTensor.numBytes(),
          "outs" to intr.outputTensorCount,
          "outs.bytes" to outputBuffers.values.sumOf { it.capacity() }
        )
      }
    } catch (t: Throwable) {
      // Si la asignación falla, dejamos el estado limpio y propagamos como ModelLoad
      inputBuffer = null
      outputBuffers.clear()
      outputsMap.clear()
      logE(TAG, t) { "buffers_alloc_fail" }
      throw ModelLoadException("Fallo asignando buffers de entrada/salida", t)
    }
  }

  /** Mapea 1:1 las salidas del intérprete a nuestros ByteBuffers. */
  private fun rebuildOutputsMap() {
    outputsMap.clear()
    for ((idx, buf) in outputBuffers) {
      outputsMap[idx] = buf
    }
  }

  /** Aserción defensiva: el map de salidas debe cubrir todos los índices. */
  private fun sanityCheckOutputMapping() {
    val intr = interpreter ?: return
    val expected = intr.outputTensorCount
    check(outputsMap.size == expected) {
      "outputs_map_mismatch " + kv("expected" to expected, "actual" to outputsMap.size)
    }
  }


  private fun loadModelFile(file: File): ByteBuffer =
    try {
      FileInputStream(file).use { fis ->
        val channel = fis.channel
        val size = channel.size()
        // Validación simple de tamaño (prevenir overflow al hacer toInt)
        require(size > 0 && size <= Int.MAX_VALUE) {
          "model_file_size_invalid " + kv("size" to size)
        }
        val buffer = ByteBuffer.allocateDirect(size.toInt())
        val read = channel.read(buffer).toLong()
        check(read == size) {
          "model_file_read_incomplete " + kv("expected" to size, "read" to read)
        }
        buffer.flip()
        buffer
      }
    } catch (t: Throwable) {
      throw IoException("Fallo leyendo el archivo del modelo desde disco", t)
    }
}
