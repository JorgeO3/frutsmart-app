package com.skybolt

import android.app.Application
import android.os.SystemClock
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.skybolt.azureblob.crypto.FastMD5
import com.skybolt.core.auth.AuthEnvironment
import com.skybolt.core.auth.toAuthTokens
import com.skybolt.core.config.CloudUploadSettings
import com.skybolt.core.events.Events
import com.skybolt.core.events.NativeEventSink
import com.skybolt.core.facade.SkyboltManager
import com.skybolt.core.upload.api.SessionConfig
import com.skybolt.core.util.AppLogger
import com.skybolt.core.util.LogLevel
import com.skybolt.core.util.logger
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

class NativeSkyboltModule(reactContext: ReactApplicationContext) : NativeSkyboltSpec(reactContext) {
  private val log by logger()
  private val moduleScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

  override fun initialize() {
    super.initialize()

    val appContext = reactApplicationContext.applicationContext
    val bootMs = SystemClock.elapsedRealtime()
    val prefix = "Skybolt"
    val minLevel = if (BuildConfig.DEBUG) LogLevel.VERBOSE else LogLevel.WARN
    log.i { "[DIAG] NativeSkybolt.initialize ENTER elapsedMs=$bootMs thread=${Thread.currentThread().name}" }
    AppLogger.init(
        prefix = prefix,
        isDebug = BuildConfig.DEBUG,
        minLevel = minLevel,
        application = appContext as? Application)

    log.i { "[DIAG] NativeSkybolt.initialize BEFORE SkyboltManager.initialize elapsedMs=${SystemClock.elapsedRealtime()}" }
    SkyboltManager.initialize(appContext)
    log.i { "[DIAG] NativeSkybolt.initialize AFTER SkyboltManager.initialize elapsedMs=${SystemClock.elapsedRealtime()}" }
    Events.setSink(NativeEventSink { type, payload ->
      log.i { "[DIAG] NativeEventSink: type=$type, payloadSize=${payload.size}" }
      val event = LinkedHashMap<String, Any?>(payload.size + 1)
      event["type"] = type
      event.putAll(payload)
      sendEvent("onUploadEvent", NativeSkyboltConverters.toWritableMap(event))
      log.i { "[DIAG] sendEvent completed for type=$type" }
    })

    log.i { "[DIAG] NativeSkybolt.initialize EXIT elapsedMs=${SystemClock.elapsedRealtime()}" }
    log.i { "NativeSkybolt initialized" }
  }

  override fun invalidate() {
    Events.clear()
    SkyboltManager.cleanupForDevelopment()
    super.invalidate()
    log.i { "NativeSkybolt invalidated" }
  }

  override fun configure(settings: ReadableMap, promise: Promise) {
    launchPromise(promise) {
      val settingsMap = NativeSkyboltConverters.toKotlinMap(settings)
      SkyboltManager.configure(CloudUploadSettings.fromMap(settingsMap))
      promise.resolve(null)
    }
  }

  override fun initializeSession(config: ReadableMap, promise: Promise) {
    launchPromise(promise) {
      val configMap = NativeSkyboltConverters.toKotlinMap(config)
      SkyboltManager.initializeSession(SessionConfig.fromJsMap(configMap))
      promise.resolve(null)
    }
  }

  override fun startSession(sessionId: String, promise: Promise) {
    launchPromise(promise) {
      SkyboltManager.startSession(sessionId)
      promise.resolve(null)
    }
  }

  override fun pauseSession(sessionId: String, promise: Promise) {
    launchPromise(promise) {
      SkyboltManager.pauseSession(sessionId)
      promise.resolve(null)
    }
  }

  override fun resumeSession(sessionId: String, promise: Promise) {
    launchPromise(promise) {
      SkyboltManager.resumeSession(sessionId)
      promise.resolve(null)
    }
  }

  override fun cancelSession(sessionId: String, promise: Promise) {
    launchPromise(promise) {
      SkyboltManager.cancelSession(sessionId)
      promise.resolve(null)
    }
  }

  override fun getSessionProgress(sessionId: String, promise: Promise) {
    launchPromise(promise) {
      val progress = SkyboltManager.getSessionProgress(sessionId)
      if (progress == null) {
        promise.resolve(null)
      } else {
        promise.resolve(NativeSkyboltConverters.toWritableMap(progress.toJsMap()))
      }
    }
  }

  override fun listActiveSessions(promise: Promise) {
    launchPromise(promise) {
      promise.resolve(NativeSkyboltConverters.toWritableArray(SkyboltManager.listActiveSessions()))
    }
  }

  override fun listPendingSessions(promise: Promise) {
    launchPromise(promise) {
      val sessions = SkyboltManager.listPendingSessions().map { session ->
        NativeSkyboltConverters.toWritableMap(session)
      }
      promise.resolve(NativeSkyboltConverters.toWritableArray(sessions))
    }
  }

  override fun resumeAllPending(promise: Promise) {
    launchPromise(promise) {
      promise.resolve(SkyboltManager.resumeAllPending().toDouble())
    }
  }

  override fun notifyAuthRefreshed(promise: Promise) {
    launchPromise(promise) {
      SkyboltManager.notifyAuthRefreshed()
      promise.resolve(null)
    }
  }

  override fun setAuthTokens(tokens: ReadableMap, promise: Promise) {
    launchPromise(promise) {
      AuthEnvironment.manager.updateTokens(NativeSkyboltConverters.toKotlinMap(tokens).toAuthTokens())
      promise.resolve(null)
    }
  }

  override fun getValidAccessToken(promise: Promise) {
    launchPromise(promise) {
      promise.resolve(AuthEnvironment.manager.getValidAccessTokenOrNull())
    }
  }

  override fun clearAuthTokens(promise: Promise) {
    launchPromise(promise) {
      AuthEnvironment.manager.clear()
      promise.resolve(null)
    }
  }

  override fun purgeCompletedSessions(olderThanMs: Double, promise: Promise) {
    launchPromise(promise) {
      val purged = SkyboltManager.purgeCompletedSessions(olderThanMs.toLong())
      promise.resolve(purged.toDouble())
    }
  }

  override fun cleanupTempFiles(promise: Promise) {
    launchPromise(promise) {
      promise.resolve(SkyboltManager.cleanupTempFiles().toDouble())
    }
  }

  override fun extractMD5FromFiles(fileUris: ReadableArray, promise: Promise) {
    launchPromise(promise) {
      val uris = NativeSkyboltConverters.toKotlinList(fileUris).filterIsInstance<String>()
      val results = FastMD5.computeMd5HexBatch(ctx = reactApplicationContext, uris = uris)
      val jsResults = results.map { result ->
        mapOf(
            "uri" to result.uri,
            "md5Hex" to result.md5Hex,
            "sizeBytes" to result.sizeBytes,
            "contentType" to result.contentType,
            "lastModifiedMs" to result.lastModifiedMs,
        )
      }
      val writableResults = jsResults.map { NativeSkyboltConverters.toWritableMap(it) }
      promise.resolve(NativeSkyboltConverters.toWritableArray(writableResults))
    }
  }

  override fun addListener(eventType: String) {
    // Required by React Native event emitter contract.
  }

  override fun removeListeners(count: Double) {
    // Required by React Native event emitter contract.
  }

  private fun sendEvent(eventName: String, payload: com.facebook.react.bridge.WritableMap) {
    try {
      val emitter = reactApplicationContext
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      if (emitter == null) {
        log.e { "[DIAG] sendEvent: getJSModule returned null for $eventName — event LOST" }
        return
      }
      emitter.emit(eventName, payload)
      log.i { "[DIAG] sendEvent emitted OK: $eventName" }
    } catch (t: Throwable) {
      log.e(t) { "[DIAG] sendEvent crashed for $eventName: ${t.message}" }
    }
  }

  private fun launchPromise(promise: Promise, block: suspend () -> Unit) {
    moduleScope.launch {
      try {
        block()
      } catch (error: Throwable) {
        promise.reject("E_SKYBOLT", error.message ?: "Skybolt operation failed", error)
      }
    }
  }
}
