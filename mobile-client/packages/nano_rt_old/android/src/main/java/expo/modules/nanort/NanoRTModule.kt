package expo.modules.nanort

import android.graphics.Bitmap
import android.net.Uri
import android.os.Build
import android.util.Log
import androidx.core.net.toUri
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.*
import java.io.File
import java.io.FileOutputStream
import java.util.UUID
import org.opencv.android.OpenCVLoader

// Core imports
import expo.modules.nanort.BuildConfig
import expo.modules.nanort.core.*
import expo.modules.nanort.module.io.*
import expo.modules.nanort.module.opencv.*
import expo.modules.nanort.module.interpreter.*
import expo.modules.nanort.module.workflows.shared.errors.SingleSegmentRequiredException
import expo.modules.nanort.module.workflows.shared.errors.SingleSegmentRequiredException.Reason

// Workflow imports
import expo.modules.nanort.module.workflows.plant.pipelines.*
import expo.modules.nanort.module.workflows.plant.workflows.*
import expo.modules.nanort.module.workflows.field.pipelines.*
import expo.modules.nanort.module.workflows.field.workflows.*

/**
 * Expo Modules wrapper for ML workflows with lifecycle management and unified API.
 */
class NanoRTModule : Module() {
  companion object {
    private const val TAG = "ExpoNanoRT"
    private const val VERSION = "1.0.0-android"
    private const val LITE_RT_VERSION = "1.4.0"
    private const val ENGINE = "LiteRT+OpenCV"
  }

  @Volatile 
  private var bootstrapped = false // track if module has been fully initialized

  @Volatile
  private var hasObservers = false // track if there are js observers for events

  private val moduleScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
  private val initState = ModuleInitStateMachine()

  // Lazy initialization of workflows
  private val plantWorkflow by lazy {
    PlantWorkflow(
      plantRingSegmentationPipeline = PlantRingSegmentationPipeline(),
      plantBunchSegmentationPipeline = PlantBunchSegmentationPipeline(),
      plantSingleSegmentationPipeline = PlantSingleSegmentationPipeline(),
      plantExternalClassificationPipeline = PlantExternalClassificationPipeline(),
      plantInternalClassificationPipeline = PlantInternalClassificationPipeline(),
    )
  }

  private val fieldWorkflow by lazy {
    FieldWorkflow(
      segmentationPipeline = FieldSegmentationPipeline(),
      externalClassificationPipeline = FieldExternalClassificationPipeline(),
      internalClassificationPipeline = FieldInternalClassificationPipeline()
    )
  }

  override fun definition() = ModuleDefinition {
    Name("NanoRT")

    Constants(
      "version" to VERSION,
      "liteRT" to LITE_RT_VERSION,
      "engine" to ENGINE
    )

    Events("onReady", "onInitError")

    OnStartObserving {
      hasObservers = true
      Log.d(TAG, "JS observers attached")
    }

    OnStopObserving {
      hasObservers = false
      Log.d(TAG, "JS observers detached")
    }

    Function("isReady") { initState.isReady() }

    AsyncFunction("initialize") Coroutine { ->
      initState.awaitReady()
      true
    }

    AsyncFunction("initializeModule") Coroutine { ->
      try {
        maybeRetryWarmupAfterFailure()

        if (!bootstrapped) {
          initializeModuleInternal()
        } else {
          startWarmupIfNeeded()
        }

        initState.awaitReady()
        mapOf(
          "success" to true,
          "message" to "Module initialized successfully",
          "version" to VERSION
        )
      } catch (t: Throwable) {
        Log.e(TAG, "Manual initialization failed", t)
        throw CodedException("init_failed", "Manual module initialization failed: ${t.message}", t)
      }
    }

    OnCreate { 
      try {
        initializeBasicComponents()
      } catch (t: Throwable) {
        Log.e(TAG, "Basic initialization failed", t)
      }
    }

    OnDestroy { 
      cleanupModule() 
    }

    // Public API methods
    AsyncFunction("classifyPlantExternal") Coroutine { imageUri: String ->
      executeWorkflow(imageUri) { bitmap ->
        plantWorkflow.runExternalClassification(bitmap).let { result ->
          validateItemCount(result.segmentedBitmaps.size, result.classifications.size, "plant_external")
          result.segmentedBitmaps.zip(result.classifications) { bmp, classification ->
            bmp to classification.confidences.toList()
          }
        }
      }
    }

    AsyncFunction("classifyPlantInternal") Coroutine { imageUri: String ->
      executeWorkflow(imageUri) { bitmap ->
        plantWorkflow.runInternalClassification(bitmap).let { result ->
          validateItemCount(result.segmentedBitmaps.size, result.classifications.size, "plant_internal")
          result.segmentedBitmaps.zip(result.classifications) { bmp, classification ->
            bmp to classification.confidences.toList()
          }
        }
      }
    }

    AsyncFunction("classifyFieldExternal") Coroutine { imageUri: String ->
      executeWorkflow(imageUri) { bitmap ->
        fieldWorkflow.runExternalClassification(bitmap).let { result ->
          validateItemCount(result.segmentedBitmaps.size, result.classifications.size, "field_external")
          result.segmentedBitmaps.zip(result.classifications) { bmp, classification ->
            bmp to classification.confidences.toList()
          }
        }
      }
    }

    AsyncFunction("classifyFieldInternal") Coroutine { imageUri: String ->
      executeWorkflow(imageUri) { bitmap ->
        fieldWorkflow.runInternalClassification(bitmap).let { result ->
          validateItemCount(result.segmentedBitmaps.size, result.classifications.size, "field_internal")
          result.segmentedBitmaps.zip(result.classifications) { bmp, classification ->
            bmp to classification.confidences.toList()
          }
        }
      }
    }
  }

  // ------------------------------------------------------------------------------------------------
  // Private helper methods
  // ------------------------------------------------------------------------------------------------

  private fun initializeBasicComponents() {
    val context = appContext.reactContext?.applicationContext 
      ?: throw CodedException("context_unavailable", "React context is null", null)

    if (bootstrapped) return
    
    synchronized(this) {
      if (bootstrapped) return
      
      // Solo inicialización mínima requerida
      initializeOpenCV()
      initializeLogging(context as android.app.Application)
      
      logD(TAG) { "basic_components_initialized" }
    }
  }

  private fun initializeModuleInternal() {
    val context = appContext.reactContext?.applicationContext 
      ?: throw CodedException("context_unavailable", "React context is null", null)

    if (bootstrapped) return
    
    synchronized(this) {
      if (bootstrapped) return
      
      try {
        // Inicialización completa
        if (!OpenCVLoader.initLocal()) {
          // Re-intentar OpenCV si no fue inicializado en básico
          initializeOpenCV()
        }
        
        val app = context as android.app.Application

        initializeLogging(app)
        initializeAssets(app)
        
        bootstrapped = true
        logD(TAG) { "full_module_initialized" }
        
        // Start warmup process
        startWarmupIfNeeded()
        
      } catch (t: Throwable) {
        Log.e(TAG, "Full initialization failed", t)
        throw CodedException("init_failed", "Module initialization failed", t)
      }
    }
  }

  private fun initializeModule() = initializeModuleInternal()

  private fun startWarmupIfNeeded() {
    if (initState.markInitializingIfIdle()) {
      moduleScope.launch { performWarmup() }
    }
  }

  private fun maybeRetryWarmupAfterFailure() {
    if (initState.resetForRetryIfFailed() && bootstrapped) {
      startWarmupIfNeeded()
    }
  }

  private fun initializeOpenCV() {
    if (!OpenCVLoader.initLocal()) {
      Log.e(TAG, "opencv_init fail")
      throw CodedException("init_failed", "OpenCV initialization failed", null)
    }
    Log.i(TAG, "opencv_init ok")
  }

  private fun initializeLogging(app: android.app.Application) {
    ModuleLogger.init(
      application = app,
      isDebug = BuildConfig.DEBUG,
      prefix = "Fruto",
      honorSystemProperties = false
    )
    logI("DeviceFingerprint") { "fingerprint=${Build.FINGERPRINT}" }
  }

  private fun initializeAssets(app: android.app.Application) {
    AppAssets.init(app)
    val repo = ImageRepositoryImpl(app)
    ImageRepository.initialize(repo)
  }

  private suspend fun performWarmup() {
    runCatching { InterpreterWarmer.warmUp() }
      .onSuccess {
      initState.markReady()
      logD(TAG) { "warmup_completed" }
      emitInitEvent("onReady")
    }.onFailure { t ->
      initState.markFailure(t)
      logE(TAG, t) { "warmup_fail" }
      emitInitEvent(
        "onInitError",
        mapOf(
          "message" to (t.message ?: "unknown"),
          "type" to t::class.java.simpleName
        )
      )
    }
  }

  /**
  * Cleans up module resources and cancels ongoing work.
  *
  * Called from the module's `OnDestroy` lifecycle hook.
  *
  * The order of operations is important:
  *  1. Cancel [moduleScope] to stop any ongoing coroutines and prevent new work
  *     from touching the models.
  *  2. Call [ModelManager.shutdownBlocking] to synchronously release native
  *     resources associated with the models.
  *
  * Wrapping shutdown in a try/catch ensures that teardown errors are logged
  * but do not crash the host.
  */
  private fun cleanupModule() {
    // 1) Cancel all coroutines launched by this module
    Log.i(TAG, "NanoRTModule OnDestroy: cancelling moduleScope")
    moduleScope.cancel()

    // 2) Shut down native model resources
    try {
      Log.i(TAG, "onDestroy_begin (ModelManager.shutdown)")
      runBlocking(Dispatchers.Default) {
        ModelManager.shutdown()
      }
      Log.i(TAG, "onDestroy_ok")
    } catch (t: Throwable) {
      Log.e(TAG, "onDestroy_fail", t)
    }
  }

  private suspend inline fun executeWorkflow(
    imageUri: String,
    crossinline workflow: suspend (Bitmap) -> List<Pair<Bitmap, List<Float>>>
  ): Map<String, Any> {
    val src = loadBitmapOrThrow(imageUri)
    var segmented: List<Pair<Bitmap, List<Float>>>? = null
    return try {
      segmented = workflow(src)
      val uris = withContext(Dispatchers.IO) {
        segmented.map { (bmp, _) -> saveBitmap(bmp) }
      }
      val itemPairs = uris.zip(segmented.map { it.second })
      itemsResult(itemPairs)
    } catch (t: Throwable) {
      Log.e(TAG, "workflow execution failed for uri=$imageUri", t)
      throw mapToCodedException(t)
    } finally {
      segmented?.forEach { (bmp, _) -> bmp.safeRecycle() }
      segmented = null
      src.safeRecycle()
      logD(TAG) { "execute_workflow_cleanup" }
    }
  }

  private suspend fun loadBitmapOrThrow(uriString: String): Bitmap = withContext(Dispatchers.IO) {
    require(uriString.isNotBlank()) { throw CodedException("bad_input", "empty_uri", null) }
    
    val uri = runCatching { uriString.toUri() }
      .getOrElse { throw CodedException("bad_input", "invalid_uri: '$uriString'", null) }
    
    runCatching {
      ImageRepository.getInstance().getImageFromUri(uri).also { bitmap ->
        require(!bitmap.isRecycled) { throw CodedException("io_error", "bitmap_recycled", null) }
      }
    }.getOrElse { t ->
      Log.e(TAG, "image_load_fail uri=$uriString", t)
      throw CodedException("io_error", "failed_to_load_bitmap", t)
    }
  }

  private fun saveBitmap(
    bitmap: Bitmap, 
    format: Bitmap.CompressFormat = Bitmap.CompressFormat.WEBP_LOSSY,
    quality: Int = 100
  ): String {
    val extension = when (format) {
      Bitmap.CompressFormat.PNG -> "png"
      Bitmap.CompressFormat.JPEG -> "jpg"
      Bitmap.CompressFormat.WEBP_LOSSY, Bitmap.CompressFormat.WEBP_LOSSLESS -> "webp"
      else -> "webp"
    }

    val file = File(getTmpDir(), "nanort_${UUID.randomUUID()}.$extension")
    FileOutputStream(file).use { out ->
      bitmap.compress(format, quality, out)
    }
    bitmap.takeUnless { it.isRecycled }?.recycle()
    return Uri.fromFile(file).toString()
  }

  // Convenience methods for backward compatibility and specific formats
  private fun saveBitmapWebP(bitmap: Bitmap, quality: Int = 85): String =
    saveBitmap(bitmap, Bitmap.CompressFormat.WEBP_LOSSY, quality)

  private fun saveBitmapPng(bitmap: Bitmap): String =
    saveBitmap(bitmap, Bitmap.CompressFormat.PNG, 100)

  private fun getCacheDir(): File = 
    appContext.reactContext?.cacheDir 
      ?: throw CodedException("context_unavailable", "Cache directory unavailable", null)

  private fun getFilesDir(): File = 
    appContext.reactContext?.filesDir 
      ?: throw CodedException("context_unavailable", "Files directory unavailable", null)
  
  private fun getTmpDir(): File =
    File(getFilesDir(), "tmp_media/inference").also { dir ->
      if (!dir.mkdirs() && !dir.exists()) {
        throw CodedException("io_error", "failed_to_create_tmp_dir: ${dir.absolutePath}", null)
      }
    }

  private fun itemsResult(items: List<Pair<String, List<Float>>>): Map<String, Any> =
    mapOf("items" to items.map { (uri, confidences) -> 
      mapOf("uri" to uri, "confidences" to confidences) 
    })

  private fun validateItemCount(bitmapCount: Int, classificationCount: Int, operation: String) {
    if (bitmapCount != classificationCount) {
      throw CodedException(
        "pipeline_mismatch",
        "${operation}_count_mismatch bitmaps=$bitmapCount scores=$classificationCount",
        null
      )
    }
  }

  private fun validateSingleItem(bitmapCount: Int, classificationCount: Int, operation: String) {
    if (bitmapCount != 1 || classificationCount != 1) {
      throw CodedException(
        "pipeline_contract",
        "${operation}_expected_single bitmaps=$bitmapCount scores=$classificationCount",
        null
      )
    }
  }

  private fun mapToCodedException(t: Throwable): CodedException = when (t) {
    is SingleSegmentRequiredException -> {
      val (code, msg) = when (t.reason) {
        Reason.NO_SEGMENT -> "no_segment" to (t.message ?: "No segment was found.")
        Reason.MULTIPLE_SEGMENTS -> "multi_segment" to (t.message ?: "Multiple segments were found.")
      }
      CodedException(code, msg, t)
    }
    else -> CodedException("pipeline_failed", t.message ?: "Native pipeline failed", t)
  }

  private fun emitInitEvent(
    eventName: String,
    payload: Map<String, Any> = emptyMap()
  ) {
    if (!hasObservers) {
      Log.w(TAG, "Skipping $eventName event: no JS observers attached")
      return
    }
    Log.i(TAG, "Emitting init event: $eventName payload=$payload")
    sendEvent(eventName, payload)
  }
}
