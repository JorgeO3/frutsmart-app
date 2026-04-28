package com.nanort

import android.graphics.Bitmap
import android.net.Uri
import android.os.Build
import android.util.Log
import androidx.core.net.toUri
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableNativeArray
import com.facebook.react.bridge.WritableNativeMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.nanort.core.AppAssets
import com.nanort.core.ModuleLogger
import com.nanort.core.logD
import com.nanort.core.logE
import com.nanort.core.logI
import com.nanort.module.interpreter.InterpreterWarmer
import com.nanort.module.interpreter.ModelManager
import com.nanort.module.io.ImageRepository
import com.nanort.module.io.ImageRepositoryImpl
import com.nanort.module.opencv.safeRecycle
import com.nanort.module.workflows.field.pipelines.FieldExternalClassificationPipeline
import com.nanort.module.workflows.field.pipelines.FieldInternalClassificationPipeline
import com.nanort.module.workflows.field.pipelines.FieldSegmentationPipeline
import com.nanort.module.workflows.field.workflows.FieldWorkflow
import com.nanort.module.workflows.plant.pipelines.PlantBunchSegmentationPipeline
import com.nanort.module.workflows.plant.pipelines.PlantExternalClassificationPipeline
import com.nanort.module.workflows.plant.pipelines.PlantInternalClassificationPipeline
import com.nanort.module.workflows.plant.pipelines.PlantRingSegmentationPipeline
import com.nanort.module.workflows.plant.pipelines.PlantSingleSegmentationPipeline
import com.nanort.module.workflows.plant.workflows.PlantWorkflow
import com.nanort.module.workflows.shared.errors.SingleSegmentRequiredException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withContext
import org.opencv.android.OpenCVLoader
import java.io.File
import java.io.FileOutputStream
import java.util.UUID

private class NanoRTException(
  val code: String,
  message: String,
  cause: Throwable? = null,
) : RuntimeException(message, cause)

class NativeNanoRTModule(reactContext: ReactApplicationContext) : NativeNanoRTSpec(reactContext) {
  companion object {
    private const val TAG = "NativeNanoRT"
    private const val VERSION = "1.0.0-android"
  }

  @Volatile
  private var bootstrapped = false

  private val moduleScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
  private val initState = ModuleInitStateMachine()

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
      internalClassificationPipeline = FieldInternalClassificationPipeline(),
    )
  }

  override fun initialize() {
    super.initialize()
    try {
      initializeBasicComponents()
    } catch (error: Throwable) {
      Log.e(TAG, "Basic initialization failed", error)
    }
  }

  override fun invalidate() {
    cleanupModule()
    super.invalidate()
  }

  override fun isReady(): Boolean = initState.isReady()

  override fun initialize(promise: Promise) {
    moduleScope.launch {
      try {
        initState.awaitReady()
        promise.resolve(true)
      } catch (error: Throwable) {
        rejectPromise(promise, error)
      }
    }
  }

  override fun initializeModule(promise: Promise) {
    moduleScope.launch {
      try {
        maybeRetryWarmupAfterFailure()
        if (!bootstrapped) {
          initializeModuleInternal()
        } else {
          startWarmupIfNeeded()
        }

        initState.awaitReady()
        val result = WritableNativeMap()
        result.putBoolean("success", true)
        result.putString("message", "Module initialized successfully")
        result.putString("version", VERSION)
        promise.resolve(result)
      } catch (error: Throwable) {
        rejectPromise(promise, error)
      }
    }
  }

  override fun classifyPlantExternal(imageUri: String, promise: Promise) {
    runWorkflowPromise(promise, imageUri) { bitmap ->
      val result = plantWorkflow.runExternalClassification(bitmap)
      validateItemCount(result.segmentedBitmaps.size, result.classifications.size, "plant_external")
      result.segmentedBitmaps.zip(result.classifications) { bmp, classification ->
        bmp to classification.confidences.toList()
      }
    }
  }

  override fun classifyPlantInternal(imageUri: String, promise: Promise) {
    runWorkflowPromise(promise, imageUri) { bitmap ->
      val result = plantWorkflow.runInternalClassification(bitmap)
      validateItemCount(result.segmentedBitmaps.size, result.classifications.size, "plant_internal")
      result.segmentedBitmaps.zip(result.classifications) { bmp, classification ->
        bmp to classification.confidences.toList()
      }
    }
  }

  override fun classifyFieldExternal(imageUri: String, promise: Promise) {
    runWorkflowPromise(promise, imageUri) { bitmap ->
      val result = fieldWorkflow.runExternalClassification(bitmap)
      validateItemCount(result.segmentedBitmaps.size, result.classifications.size, "field_external")
      result.segmentedBitmaps.zip(result.classifications) { bmp, classification ->
        bmp to classification.confidences.toList()
      }
    }
  }

  override fun classifyFieldInternal(imageUri: String, promise: Promise) {
    runWorkflowPromise(promise, imageUri) { bitmap ->
      val result = fieldWorkflow.runInternalClassification(bitmap)
      validateItemCount(result.segmentedBitmaps.size, result.classifications.size, "field_internal")
      result.segmentedBitmaps.zip(result.classifications) { bmp, classification ->
        bmp to classification.confidences.toList()
      }
    }
  }

  override fun addListener(eventType: String) {}

  override fun removeListeners(count: Double) {}

  private fun initializeBasicComponents() {
    val context = reactApplicationContext.applicationContext as? android.app.Application
      ?: throw NanoRTException("context_unavailable", "React context is null")

    if (bootstrapped) return
    synchronized(this) {
      if (bootstrapped) return
      initializeOpenCV()
      initializeLogging(context)
      logD(TAG) { "basic_components_initialized" }
    }
  }

  private fun initializeModuleInternal() {
    val context = reactApplicationContext.applicationContext as? android.app.Application
      ?: throw NanoRTException("context_unavailable", "React context is null")

    if (bootstrapped) return
    synchronized(this) {
      if (bootstrapped) return
      try {
        if (!OpenCVLoader.initLocal()) {
          initializeOpenCV()
        }
        initializeLogging(context)
        initializeAssets(context)
        bootstrapped = true
        logD(TAG) { "full_module_initialized" }
        startWarmupIfNeeded()
      } catch (error: Throwable) {
        throw NanoRTException("init_failed", "Module initialization failed", error)
      }
    }
  }

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
      throw NanoRTException("init_failed", "OpenCV initialization failed")
    }
  }

  private fun initializeLogging(app: android.app.Application) {
    ModuleLogger.init(
      application = app,
      isDebug = BuildConfig.DEBUG,
      prefix = "Fruto",
      honorSystemProperties = false,
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
        emitInitEvent("onReady", emptyMap())
      }
      .onFailure { error ->
        initState.markFailure(error)
        logE(TAG, error) { "warmup_fail" }
        emitInitEvent(
          "onInitError",
          mapOf(
            "message" to (error.message ?: "unknown"),
            "type" to error::class.java.simpleName,
          ),
        )
      }
  }

  private fun cleanupModule() {
    moduleScope.cancel()
    try {
      runBlocking(Dispatchers.Default) {
        ModelManager.shutdown()
      }
    } catch (error: Throwable) {
      Log.e(TAG, "onDestroy_fail", error)
    }
  }

  private fun runWorkflowPromise(
    promise: Promise,
    imageUri: String,
    workflow: suspend (Bitmap) -> List<Pair<Bitmap, List<Float>>>,
  ) {
    moduleScope.launch {
      try {
        val result = executeWorkflow(imageUri, workflow)
        promise.resolve(result)
      } catch (error: Throwable) {
        rejectPromise(promise, error)
      }
    }
  }

  private suspend fun executeWorkflow(
    imageUri: String,
    workflow: suspend (Bitmap) -> List<Pair<Bitmap, List<Float>>>,
  ): WritableNativeMap {
    val src = loadBitmapOrThrow(imageUri)
    var segmented: List<Pair<Bitmap, List<Float>>>? = null
    return try {
      segmented = workflow(src)
      val uris = withContext(Dispatchers.IO) { segmented.map { (bmp, _) -> saveBitmap(bmp) } }
      val itemPairs = uris.zip(segmented.map { it.second })
      itemsResult(itemPairs)
    } catch (error: Throwable) {
      throw mapToModuleException(error)
    } finally {
      segmented?.forEach { (bmp, _) -> bmp.safeRecycle() }
      src.safeRecycle()
    }
  }

  private suspend fun loadBitmapOrThrow(uriString: String): Bitmap = withContext(Dispatchers.IO) {
    if (uriString.isBlank()) {
      throw NanoRTException("bad_input", "empty_uri")
    }

    val uri = runCatching { uriString.toUri() }
      .getOrElse { throw NanoRTException("bad_input", "invalid_uri: '$uriString'") }

    runCatching {
      ImageRepository.getInstance().getImageFromUri(uri).also { bitmap ->
        if (bitmap.isRecycled) {
          throw NanoRTException("io_error", "bitmap_recycled")
        }
      }
    }.getOrElse { error ->
      throw NanoRTException("io_error", "failed_to_load_bitmap", error)
    }
  }

  private fun saveBitmap(
    bitmap: Bitmap,
    format: Bitmap.CompressFormat = Bitmap.CompressFormat.WEBP_LOSSY,
    quality: Int = 100,
  ): String {
    val extension = when (format) {
      Bitmap.CompressFormat.PNG -> "png"
      Bitmap.CompressFormat.JPEG -> "jpg"
      Bitmap.CompressFormat.WEBP_LOSSY, Bitmap.CompressFormat.WEBP_LOSSLESS -> "webp"
      else -> "webp"
    }

    val file = File(getTmpDir(), "nanort_${UUID.randomUUID()}.$extension")
    FileOutputStream(file).use { out -> bitmap.compress(format, quality, out) }
    bitmap.takeUnless { it.isRecycled }?.recycle()
    return Uri.fromFile(file).toString()
  }

  private fun getFilesDir(): File = reactApplicationContext.filesDir
    ?: throw NanoRTException("context_unavailable", "Files directory unavailable")

  private fun getTmpDir(): File =
    File(getFilesDir(), "tmp_media/inference").also { dir ->
      if (!dir.mkdirs() && !dir.exists()) {
        throw NanoRTException("io_error", "failed_to_create_tmp_dir: ${dir.absolutePath}")
      }
    }

  private fun itemsResult(items: List<Pair<String, List<Float>>>): WritableNativeMap {
    val result = WritableNativeMap()
    val arr = WritableNativeArray()
    items.forEach { (uri, confidences) ->
      val itemMap = WritableNativeMap()
      itemMap.putString("uri", uri)
      val confidenceArray = WritableNativeArray()
      confidences.forEach { confidenceArray.pushDouble(it.toDouble()) }
      itemMap.putArray("confidences", confidenceArray)
      arr.pushMap(itemMap)
    }
    result.putArray("items", arr)
    return result
  }

  private fun validateItemCount(bitmapCount: Int, classificationCount: Int, operation: String) {
    if (bitmapCount != classificationCount) {
      throw NanoRTException(
        "pipeline_mismatch",
        "${operation}_count_mismatch bitmaps=$bitmapCount scores=$classificationCount",
      )
    }
  }

  private fun mapToModuleException(error: Throwable): NanoRTException = when (error) {
    is NanoRTException -> error
    is SingleSegmentRequiredException -> {
      val code = when (error.reason) {
        SingleSegmentRequiredException.Reason.NO_SEGMENT -> "no_segment"
        SingleSegmentRequiredException.Reason.MULTIPLE_SEGMENTS -> "multi_segment"
      }
      NanoRTException(code, error.message ?: "Segment validation failed", error)
    }
    else -> NanoRTException("pipeline_failed", error.message ?: "Native pipeline failed", error)
  }

  private fun emitInitEvent(eventName: String, payload: Map<String, Any>) {
    val writablePayload = WritableNativeMap()
    payload.forEach { (key, value) ->
      when (value) {
        is String -> writablePayload.putString(key, value)
        is Boolean -> writablePayload.putBoolean(key, value)
        is Int -> writablePayload.putInt(key, value)
        is Double -> writablePayload.putDouble(key, value)
        is Float -> writablePayload.putDouble(key, value.toDouble())
        else -> writablePayload.putString(key, value?.toString())
      }
    }

    reactApplicationContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit(eventName, writablePayload)
  }

  private fun rejectPromise(promise: Promise, error: Throwable) {
    val moduleError = mapToModuleException(error)
    promise.reject(moduleError.code, moduleError.message, moduleError)
  }
}
