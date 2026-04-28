package expo.modules.nanort.module.interpreter

import android.os.Build

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext

import java.io.File
import java.security.MessageDigest
import java.util.concurrent.ConcurrentHashMap

import org.tensorflow.lite.gpu.CompatibilityList
import org.tensorflow.lite.gpu.GpuDelegate
import org.tensorflow.lite.gpu.GpuDelegateFactory

import expo.modules.nanort.core.AppAssets
import expo.modules.nanort.core.ModuleLogger
import expo.modules.nanort.core.logE
import expo.modules.nanort.core.logI
import expo.modules.nanort.core.logW

/**
 * Gestor singleton thread-safe para intérprete TensorFlow Lite reutilizable.
 *
 * - Una sola instancia persistente de NanoRTInterpreter.
 * - Un GpuDelegate por modelo (LRU), con serialización/caché para arranques rápidos.
 * - Carga/switch de modelos serializado en el hilo del intérprete.
 * - Blacklist por dispositivo.
 */
object ModelManager {
    sealed class ManagerException(message: String, cause: Throwable? = null) : RuntimeException(message, cause)
    class ModelLoadException(message: String, cause: Throwable? = null) : ManagerException(message, cause)
    class DelegateException(message: String, cause: Throwable? = null) : ManagerException(message, cause)
    class IoException(message: String, cause: Throwable? = null) : ManagerException(message, cause)

    // ===================== Configuración =====================
    private val TAG = ModuleLogger.createTag("ModelManager")

    // Blacklist por fingerprint → modelos
    private val deviceGpuBlacklist = mapOf(
        "motorola/bangkk_g/bangkk:14/U1TCS34.22-64-19-4-6/f9a73f-132e5c3:user/release-keys" to setOf(ModelId.RS)
    )

    // Límite de delegados cacheados (LRU)
    private const val GPU_DELEGATE_CACHE_CAPACITY = 3

    // ===================== Estado =====================
    private val operationMutex = Mutex()
    private var sharedInterpreter = NanoRTInterpreter()
    @Volatile private var currentModelId: ModelId? = null

    // Caché de hashes de modelos
    private val modelHashCache = ConcurrentHashMap<String, String>()

    // LRU de delegados por modelo (1 delegado por modelo con token único)
    private val gpuDelegates = object : LinkedHashMap<ModelId, GpuDelegate>(4, 0.75f, true) {
        override fun removeEldestEntry(eldest: MutableMap.MutableEntry<ModelId, GpuDelegate>?): Boolean {
            val evict = size > GPU_DELEGATE_CACHE_CAPACITY
            if (evict) {
                try { eldest?.value?.close() } catch (_: Throwable) { /* best-effort */ }
                logW(TAG) { "gpu_delegate_evict model=${eldest?.key?.name}" }
            }
            return evict
        }
    }

    // ===================== Helpers de logging =====================
    private fun kv(vararg pairs: Pair<String, Any?>) =
        pairs.joinToString(" ") { (k, v) -> "$k=$v" }

    // ===================== API pública =====================

    /**
     * Ejecuta un bloque con el intérprete listo para `modelId`, garantizando
     * que todo ocurre en el hilo dedicado del intérprete.
     */
    suspend fun <T> withInterpreter(modelId: ModelId, block: suspend (NanoRTInterpreter) -> T): T {
        requireNotNull(modelId) { "model_id_null" }
        val interpreter = getInterpreter(modelId)
        return withContext(interpreter.modelDispatcher) { block(interpreter) }
    }

    /**
     * Devuelve el intérprete con el modelo cargado (o lo carga si hace falta).
     */
    private suspend fun getInterpreter(modelId: ModelId): NanoRTInterpreter {
        // CAMBIO: si ya es el modelo actual, igual garantizamos que el executor esté vivo
        if (modelId == currentModelId) { // CAMBIO
            // fuerza evaluación del getter (revive si hace falta)
            sharedInterpreter.modelDispatcher // CAMBIO
            return sharedInterpreter
        }
        return operationMutex.withLock {
            if (modelId == currentModelId) {
                sharedInterpreter.modelDispatcher // CAMBIO
                return@withLock sharedInterpreter
            }
            loadModelSafely(modelId)
            sharedInterpreter
        }
    }


    /**
     * Carga el modelo de forma segura en el intérprete compartido.
     * - Resuelve GPU/CPU.
     * - Calcula hash optimizado (con caché).
     * - Obtiene/crea el GpuDelegate del LRU (con serialización).
     * - Llama a NanoRTInterpreter.loadModel(...) en su dispatcher.
     */
    private suspend fun loadModelSafely(modelId: ModelId) {
        logI(TAG) { "model_switch " + kv("from" to (currentModelId?.name ?: "none"), "to" to modelId.name) }

        try {
            val modelFile = getModelFile(modelId)
            logI(TAG) { "model_file_resolved " + kv("file" to modelFile.name, "sizeB" to modelFile.length()) }

            val modelHash = getModelHash(modelFile)
            logI(TAG) { "model_hash_ready " + kv("file" to modelFile.name, "hash" to modelHash.take(8)) }

            val useGpu = shouldUseGpuForModel(modelId)
            logI(TAG) { "delegate_decision " + kv("model" to modelId.name, "gpu" to useGpu) }

            withContext(sharedInterpreter.modelDispatcher) {
                val delegate = if (useGpu) getOrCreateGpuDelegate(modelId, modelHash) else null
                sharedInterpreter.loadModel(modelFile = modelFile, gpuDelegate = delegate)
            }

            currentModelId = modelId
            logI(TAG) { "model_load_ok " + kv("model" to modelId.name, "gpu" to useGpu) }

        } catch (e: NanoRTInterpreter.NanoRTException) {
            // Excepciones específicas del intérprete → propagar y loguear con su tipo
            currentModelId = null
            logE(TAG, e) { "model_load_fail " + kv("model" to modelId.name, "kind" to e::class.simpleName) }
            throw ModelLoadException("Fallo cargando modelo ${modelId.name}", e)
        } catch (e: ManagerException) {
            // Errores propios del manager → propagar
            currentModelId = null
            logE(TAG, e) { "model_load_fail_manager " + kv("model" to modelId.name, "kind" to e::class.simpleName) }
            throw e
        } catch (t: Throwable) {
            currentModelId = null
            logE(TAG, t) { "model_load_fail_unexpected " + kv("model" to modelId.name) }
            throw ModelLoadException("Error inesperado al cargar modelo ${modelId.name}", t)
        }
    }

    // ===================== Utilidades de carga =====================

    private fun getModelFile(modelId: ModelId): File {
        val path = AppAssets.getAssetPath(modelId.fileName)
        require(path.isNotBlank()) { "asset_path_blank " + kv("model" to modelId.name) }
        val f = File(path)
        require(f.exists() && f.isFile) {
            "model_file_invalid " + kv("path" to f.absolutePath, "exists" to f.exists(), "isFile" to f.isFile)
        }
        require(f.length() > 0L) {
            "model_file_empty " + kv("path" to f.absolutePath, "sizeB" to 0)
        }
        return f
    }


    /** Lee hash del cache o lo calcula en IO. */
    private suspend fun getModelHash(modelFile: File): String {
        val path = modelFile.absolutePath
        modelHashCache[path]?.let { return it }
        return withContext(Dispatchers.IO) {
            logI(TAG) { "hash_compute_begin " + kv("file" to modelFile.name, "sizeB" to modelFile.length()) }
            val hash = try {
                computeFileHash(modelFile)
            } catch (t: Throwable) {
                logE(TAG, t) { "hash_compute_fail " + kv("file" to modelFile.name) }
                throw IoException("Fallo calculando hash para ${modelFile.name}", t)
            }
            modelHashCache[path] = hash
            logI(TAG) { "hash_compute_ok " + kv("file" to modelFile.name, "hash" to hash.take(8)) }
            hash
        }
    }

    private fun computeFileHash(file: File): String {
        val digest = MessageDigest.getInstance("SHA-256")
        val buf = ByteArray(8192)
        file.inputStream().use { s ->
            var n: Int
            while (s.read(buf).also { n = it } != -1) digest.update(buf, 0, n)
        }
        return digest.digest().joinToString("") { "%02x".format(it) }
    }

    // ===================== Delegado GPU (LRU + serialización) =====================

    private fun getOrCreateGpuDelegate(modelId: ModelId, modelHash: String): GpuDelegate {
        gpuDelegates[modelId]?.let {
            logI(TAG) { "gpu_delegate_cache_hit " + kv("model" to modelId.name) }
            return it
        }

        // Usa opciones del device + serialización por modelo
        val compatList = CompatibilityList()
        if (!compatList.isDelegateSupportedOnThisDevice) {
            logW(TAG) { "gpu_unsupported_device " + kv("model" to modelId.name) }
            throw DelegateException("GPU no soportada; no debería solicitarse delegado.")
        }

        val cacheDir = AppAssets.getContext().codeCacheDir.absolutePath
        val opts = compatList.bestOptionsForThisDevice.apply {
            setInferencePreference(GpuDelegateFactory.Options.INFERENCE_PREFERENCE_SUSTAINED_SPEED)
            isPrecisionLossAllowed = true
            setSerializationParams(cacheDir, modelHash)
        }

        return try {
            val delegate = GpuDelegate(opts)
            gpuDelegates[modelId] = delegate
            logI(TAG) { "gpu_delegate_create " + kv("model" to modelId.name, "hash" to modelHash.take(8), "cacheDir" to cacheDir) }
            delegate
        } catch (t: Throwable) {
            logE(TAG, t) { "gpu_delegate_create_fail " + kv("model" to modelId.name) }
            throw DelegateException("Fallo creando GpuDelegate para ${modelId.name}", t)
        }
    }

    // ===================== Liberación / shutdown =====================

    /** Libera el modelo actual (no cierra delegados del LRU). */
    suspend fun releaseCurrentSession() {
        operationMutex.withLock {
            withContext(sharedInterpreter.modelDispatcher) {
                currentModelId?.let {
                    logI(TAG) { "session_release_begin " + kv("model" to it.name) }
                    runCatching { sharedInterpreter.releaseCurrentResources() }
                        .onFailure { err -> logW(TAG, err) { "session_release_fail " + kv("model" to it.name) } }
                    currentModelId = null
                    logI(TAG) { "session_release_ok" }
                } ?: logI(TAG) { "session_release_skip " + kv("reason" to "no_current_model") }
            }
        }
    }

    /** Cierra todo: intérprete + delegados LRU. */
    suspend fun shutdown() {
        operationMutex.withLock {
            logI(TAG) { "shutdown_begin " + kv("delegates" to gpuDelegates.size, "currentModel" to (currentModelId?.name ?: "none")) }
            runCatching { sharedInterpreter.close() }
                .onFailure { err -> logW(TAG, err) { "shutdown_interpreter_close_fail" } }

            gpuDelegates.values.forEach { delegate ->
                runCatching { delegate.close() }
                    .onFailure { err -> logW(TAG, err) { "shutdown_delegate_close_fail" } }
            }
            gpuDelegates.clear()
            currentModelId = null
            logI(TAG) { "shutdown_end" }
        }
    }


    fun shutdownBlocking() {
        runBlocking { shutdown() }
    }

    // ===================== GPU blacklist =====================

    private fun shouldUseGpuForModel(modelId: ModelId): Boolean {
        val blacklisted = deviceGpuBlacklist[Build.FINGERPRINT]?.contains(modelId) == true
        if (blacklisted) {
            logW(TAG) { "gpu_blacklisted " + kv("model" to modelId.name, "fingerprint" to Build.FINGERPRINT) }
            return false
        }
        val supported = CompatibilityList().isDelegateSupportedOnThisDevice
        if (!supported) logW(TAG) { "gpu_unsupported_device" }
        return supported
    }
}
