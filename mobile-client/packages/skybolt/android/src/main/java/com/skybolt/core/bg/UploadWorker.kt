package com.skybolt.core.bg


import android.content.Context
import android.os.SystemClock
import androidx.work.CoroutineWorker
import androidx.work.ForegroundInfo
import androidx.work.WorkerParameters
import com.skybolt.BuildConfig
import com.skybolt.azureblob.auth.AzureAuthConfig
import com.skybolt.azureblob.auth.AzureB2CTokenRefresher
import com.skybolt.core.http.BackendApi
import com.skybolt.azureblob.provider.BackendSasProvider
import com.skybolt.azureblob.runtime.BlobUploader
import com.skybolt.core.auth.AuthEnvironment
import com.skybolt.core.auth.TokenRefresher
import com.skybolt.core.events.Events
import com.skybolt.core.facade.SkyboltManager
import com.skybolt.core.net.Network
import com.skybolt.core.startup.StartupGate
import com.skybolt.core.storage.Mappers
import com.skybolt.core.storage.SessionRepository
import com.skybolt.core.upload.api.Err.UploadError
import com.skybolt.core.upload.api.Err.Code
import com.skybolt.core.upload.api.ItemProgress
import com.skybolt.core.upload.api.ProgressReporter
import com.skybolt.core.upload.planner.UploadPlanner
import com.skybolt.core.config.AppSettings
import com.skybolt.core.config.DataStoreSettingsPersistence
import com.skybolt.core.events.SkyboltEvent
import com.skybolt.core.http.AuthManagerBearerProvider
import com.skybolt.core.http.CompositeAuthProvider
import com.skybolt.core.http.StaticHeadersProvider
import com.skybolt.core.upload.driver.BlobDriver

import com.skybolt.core.util.LogSanitizer
import com.skybolt.core.util.logger
import com.skybolt.proto.ItemRecord
import com.skybolt.proto.UploadSessionState
import com.skybolt.proto.UploadSessionState.SessionStatus
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.ConnectionPool
import okhttp3.ConnectionSpec
import okhttp3.OkHttpClient
import java.util.concurrent.TimeUnit
import androidx.work.ListenableWorker.Result as WMResult
import kotlin.Result as KtResult

/**
 * Orquesta la subida multi-archivo con persistencia y eventos.
 *
 * Reglas clave:
 * - La sesión la crea RN. Aquí solo se sube, se pausa y se reanuda.
 * - Si falta login (401/403 backend) → PAUSED_AUTH, evento `auth:required`, terminar sin retry.
 * - Si no hay red → PAUSED_NETWORK (o retry si así lo configuras), terminar sin retry (modo "declarativo").
 * - 429/5xx backend/blob → WMResult.retry() (backoff por WorkManager).
 * - Errores no recuperables → FAILED.
 */
class UploadWorker(
    appContext: Context,
    params: WorkerParameters
) : CoroutineWorker(appContext, params) {

    companion object {
        const val KEY_SESSION_ID = "session_id"
        private val log by logger()

        private const val FG_UPDATE_INTERVAL_MS = 1000L
        private const val JS_UPDATE_INTERVAL_MS = 300L

        @Volatile
        internal var networkConnectedOverride: ((Context) -> Boolean)? = null

        @Volatile
        internal var loadSessionOverride: (suspend (SessionRepository, String) -> UploadSessionState)? = null

        @Volatile
        internal var uploadSessionOverride:
            (suspend (UploadWorker, String, UploadSessionState) -> KtResult<Unit>)? = null

        @Volatile
        internal var onRetryRequestedOverride: (suspend (String) -> Unit)? = null

        internal fun clearTestOverrides() {
            networkConnectedOverride = null
            loadSessionOverride = null
            uploadSessionOverride = null
            onRetryRequestedOverride = null
        }
    }

    // ---- Infra compartida ----

    private val sharedOkHttp by lazy {
        val specs = if (BuildConfig.ALLOW_HTTP_IN_DEV) {
            listOf(ConnectionSpec.MODERN_TLS, ConnectionSpec.CLEARTEXT)
        } else {
            listOf(ConnectionSpec.MODERN_TLS)
        }
        OkHttpClient.Builder()
            .connectionPool(ConnectionPool(10, 5, TimeUnit.MINUTES))
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(120, TimeUnit.SECONDS)
            .writeTimeout(120, TimeUnit.SECONDS)
            .retryOnConnectionFailure(true)
            .connectionSpecs(specs)
            .build()
    }

    private val backendApi by lazy {
        // Backend client with Authorization token from React Native
        // Token is passed via configure() and stored in AppSettings
        val backendConfig = AppSettings.getBackendConfig()
        val authProvider = CompositeAuthProvider(
            AuthManagerBearerProvider(),
            StaticHeadersProvider(backendConfig.defaultHeaders)
        )
        val retryConfig = AppSettings.getRetryConfig()

        BackendApi(
            baseUrl = backendConfig.baseUrl,
            auth = authProvider,
            client = sharedOkHttp,
            sasBatchPathTemplate = backendConfig.endpoints.sasBatchPath,
            sasRefreshPathTemplate = backendConfig.endpoints.sasRefreshPath,
            maxRetries = retryConfig.maxRetries,
            baseDelayMs = retryConfig.baseDelayMs,
            maxDelayMs = retryConfig.maxDelayMs
        )
    }

    private val sasProvider by lazy {
        val sessionId = inputData.getString(KEY_SESSION_ID) ?: "unknown"
        BackendSasProvider(backendApi, sessionId) // pide/refresh SAS en batch
    }

    private val uploader by lazy {
        val retryConfig = AppSettings.getRetryConfig()
        val azureConfig = AppSettings.getAzureConfig()
        BlobUploader(
            http = sharedOkHttp,
            sasProvider = sasProvider,
            maxRetries = retryConfig.maxRetries,
            apiVersion = azureConfig.serviceVersion,
            sendBlockMd5 = azureConfig.sendBlockMd5,
            baseDelayMs = retryConfig.baseDelayMs,
            maxDelayMs = retryConfig.maxDelayMs
        )
    }

    private val sessionRepository by lazy { SessionRepository(applicationContext) }
    
    private val driver by lazy {
        BlobDriver(applicationContext, uploader, sessionRepository)
    }

    override suspend fun getForegroundInfo(): ForegroundInfo {
        val sessionId = inputData.getString(KEY_SESSION_ID) ?: "unknown"
        return Foreground.foregroundInfo(applicationContext, sessionId, -1, "Preparing upload…")
    }

    override suspend fun doWork(): WMResult = withContext(Dispatchers.IO) {
        val sessionId = inputData.getString(KEY_SESSION_ID) ?: run {
            log.e { "[DIAG] UploadWorker.doWork: KEY_SESSION_ID is null — worker will FAIL" }
            return@withContext WMResult.failure()
        }
        log.i { "[DIAG] UploadWorker.doWork START sessionId=$sessionId runAttempt=$runAttemptCount" }

        if (StartupGate.shouldDeferForegroundStartupWork(applicationContext)) {
            log.i {
                "[DIAG] UploadWorker deferred during app startup " +
                    "sessionId=$sessionId runAttempt=$runAttemptCount nanortReady=${StartupGate.isNanoRtReady(applicationContext)}"
            }
            return@withContext WMResult.retry()
        }

        setForeground(getForegroundInfo())

        try {
            log.i { "Starting UploadWorker for session $sessionId. RunAttempt: $runAttemptCount" }

            if (!AppSettings.isConfigured) {
                val persisted = DataStoreSettingsPersistence(applicationContext).load()
                if (persisted != null) {
                    AppSettings.configure(persisted)
                    log.i { "Restored Skybolt config from persistence inside worker" }
                }
            }

            ensureAuthEnvironmentReady()

            Events.emit(SkyboltEvent.SessionStarted(sessionId = sessionId))
            log.i { "[DIAG] UploadWorker emitted session:started for $sessionId" }

            // Política de red: si no hay conectividad, pausamos declarativamente
            val isConnected = networkConnectedOverride?.invoke(applicationContext)
                ?: Network.snapshot(applicationContext).isConnected

            if (!isConnected) {
                log.i { "No network connection, pausing session $sessionId" }
                markPausedAndEmit(sessionId, reason = "network")
                return@withContext WMResult.failure() // RN decidirá reanudar
            }

            val session = loadSessionOverride?.invoke(sessionRepository, sessionId)
                ?: sessionRepository.load(sessionId)
            if (session.sessionId.isEmpty()) {
                log.e { "Session $sessionId not found (empty)" }
                return@withContext WMResult.failure()
            }

            sessionRepository.setSessionStatus(sessionId, SessionStatus.UPLOADING)
            
            log.d { "Session loaded: ${session.itemsList.size} items, status=${session.status}" }

            // (Opcional) Prefetch de SAS en batch: el provider puede decidir ignorarlo
            // y hacerlo bajo demanda por item.
            // runCatching { sasProvider.prefetch(sessionId, session.itemsList) }

            val result: KtResult<Unit> = uploadSessionOverride?.invoke(this@UploadWorker, sessionId, session)
                ?: uploadSession(sessionId, session)

            if (result.isSuccess) {
                sessionRepository.setSessionStatus(sessionId, SessionStatus.COMPLETED)
                Events.emit(SkyboltEvent.SessionCompleted(sessionId = sessionId))
                log.i { "[DIAG] UploadWorker emitted session:completed for $sessionId" }
                log.i { "Session $sessionId completed successfully" }
                WMResult.success()
            } else {
                // La rama de fracaso genérico (si no fue atrapada y recategorizada)
                sessionRepository.setSessionStatus(sessionId, SessionStatus.FAILED)

                val t = result.exceptionOrNull()
                val jsError = t?.let { com.skybolt.core.bridge.ErrorMapper.toJsError(it) }
                    ?: mapOf("code" to "E_UNKNOWN", "message" to "Unknown error")
                
                val errorCode = jsError["code"] ?: "E_UNKNOWN"
                val errorMessage = jsError["message"] ?: "Unknown error"

                Events.emit(
                    SkyboltEvent.SessionFailed(
                        sessionId = sessionId,
                        errorCode = errorCode,
                        errorMessage = errorMessage
                    )
                )
                log.i { "[DIAG] UploadWorker emitted session:failed for $sessionId: $errorCode - $errorMessage" }

                log.w { "Session $sessionId failed: $errorCode - $errorMessage" }
                WMResult.failure()
            }
        } catch (_: Halt.AuthPause) {
            log.w { "Auth pause requested for session $sessionId" }
            markPausedAndEmit(sessionId = inputData.getString(KEY_SESSION_ID) ?: "unknown", reason = "auth")
            WMResult.failure()
        } catch (_: Halt.NetworkPause) {
            log.w { "Network pause requested for session $sessionId" }
            markPausedAndEmit(sessionId = inputData.getString(KEY_SESSION_ID) ?: "unknown", reason = "network")
            WMResult.failure()
        } catch (_: Halt.RetryLater) {
            log.i { "RetryLater requested for session $sessionId. Backing off." }
            onRetryRequestedOverride?.invoke(sessionId)
            WMResult.retry()
        } catch (_: CancellationException) {
            val sid = inputData.getString(KEY_SESSION_ID) ?: "unknown"
            log.i { "Session $sid canceled by user/system" }
            sessionRepository.setSessionStatus(sid, SessionStatus.CANCELED)
            Events.emit(SkyboltEvent.SessionCanceled(sessionId = sid))
            WMResult.success()
        } catch (e: Exception) {
            val sid = inputData.getString(KEY_SESSION_ID) ?: "unknown"
            log.e { "Fatal upload error: ${LogSanitizer.sanitizeException(e)}" }

            // Save PAUSED state before retry to ensure consistency on app restart
            try {
                sessionRepository.setSessionStatus(sid, SessionStatus.PAUSED)
                markPausedAndEmit(sessionId = sid, reason = "error")
            } catch (stateEx: Exception) {
                log.e { "Failed to save PAUSED state: ${stateEx.message}" }
            }

            Events.emit(SkyboltEvent.ErrorFatal(
                sessionId = sid,
                stack = e.stackTraceToString(),
                message = e.message ?: "Unknown error"
            ))

            // Limit retries to avoid FG service quota exhaustion (Android 12+)
            if (runAttemptCount >= 3) {
                log.w { "Session $sid reached max retries ($runAttemptCount). Giving up." }
                WMResult.failure()
            } else {
                WMResult.retry()
            }
        }
    }

    private suspend fun uploadSession(
        sessionId: String,
        session: UploadSessionState
    ): KtResult<Unit> = coroutineScope {
        val progressChannel = Channel<ItemProgress>(capacity = Channel.BUFFERED)
        val totalBytes = session.totalBytes.coerceAtLeast(1L)

        val writerJob = launchProgressWriter(sessionId, session, progressChannel, totalBytes)

        try {
            // Delegamos la orquestación paralela al Driver
            driver.uploadSession(this, session, progressChannel)

            progressChannel.close()
            writerJob.join()
            KtResult.success(Unit)
        } catch (h: Halt) {
            progressChannel.close()
            writerJob.join()
            throw h
        } catch (e: Exception) {
            progressChannel.close()
            writerJob.join()
            KtResult.failure(e)
        }
    }

    private fun CoroutineScope.launchProgressWriter(
        sessionId: String,
        session: UploadSessionState,
        progressChannel: Channel<ItemProgress>,
        totalBytes: Long
    ): Job = launch {
        log.d { "Starting progress writer for session $sessionId" }
        val perItemUploaded = session.itemsList.associate { it.clientItemId to it.uploadedBytes }.toMutableMap()
        var totalUploaded = session.uploadedBytes
        val throttle = ProgressEmissionThrottle(
            fgIntervalMs = FG_UPDATE_INTERVAL_MS,
            jsIntervalMs = JS_UPDATE_INTERVAL_MS,
        )

        for (progress in progressChannel) {
            val prev = perItemUploaded[progress.clientItemId] ?: 0L
            // Nota: a veces el progreso puede llegar desordenado si hay concurrencia extrema, 
            // pero aquí es un único consumidor.
            
            val delta = progress.bytesUploaded - prev
            // Solo sumamos si hay avance positivo (evitar glitches)
            if (delta > 0) {
                totalUploaded += delta
                perItemUploaded[progress.clientItemId] = progress.bytesUploaded
            }

            // Use the coalescer to avoid thrashing DataStore
            // El repositorio ya tiene log interno con sampling
            sessionRepository.updateItemProgressCoalesced(
                sessionId = sessionId,
                clientItemId = progress.clientItemId,
                uploadedBytes = progress.bytesUploaded,
                nextBlockIndex = progress.blockIndex ?: 0,
                totalBlocks = ((progress.totalBytes + (progress.blockSize ?: 1L) - 1) / (progress.blockSize ?: 1L)).toInt()
            )

            val now = SystemClock.elapsedRealtime()

            if (throttle.shouldEmitForeground(now)) {
                updateForeground(sessionId, totalUploaded, totalBytes, progress.clientItemId)
            }
            if (throttle.shouldEmitJs(now)) {
                emitProgressEvent(sessionId, progress)
            }
        }
        log.d { "Progress writer finished for session $sessionId" }
    }

    private suspend fun markPausedAndEmit(sessionId: String, reason: String) {
        sessionRepository.setSessionStatus(sessionId, SessionStatus.PAUSED)
        Events.emit(SkyboltEvent.SessionPaused(sessionId = sessionId, reason = reason))

        // Track pause reason for auto-resume
        when (reason) {
            "network" -> SkyboltManager.trackNetworkPause(sessionId)
            "auth" -> {
                SkyboltManager.trackAuthPause(sessionId)
                val pendingIds = runCatching {
                    SkyboltManager.listPendingSessions()
                        .mapNotNull { it["sessionId"] as? String }
                        .plus(sessionId)
                        .distinct()
                }.getOrElse {
                    listOf(sessionId)
                }

                Events.emit(SkyboltEvent.AuthRequired(
                    sessionId = sessionId,
                    pendingSessions = pendingIds
                ))
            }
        }
    }

    private suspend fun updateForeground(
        sessionId: String,
        uploadedBytes: Long,
        totalBytes: Long,
        currentItemId: String
    ) {
        val percent = ((uploadedBytes * 100) / totalBytes).toInt().coerceIn(0, 100)
        setForeground(
            Foreground.foregroundInfo(
                applicationContext,
                sessionId,
                percent,
                "Uploading $currentItemId… $percent%"
            )
        )
    }

    private fun emitProgressEvent(sessionId: String, progress: ItemProgress) {
        Events.emit(SkyboltEvent.ItemProgress(
            sessionId = sessionId,
            clientItemId = progress.clientItemId,
            bytesUploaded = progress.bytesUploaded,
            totalBytes = progress.totalBytes,
            blockIndex = progress.blockIndex
        ))
    }

    private suspend fun ensureAuthEnvironmentReady() {
        if (AuthEnvironment.isInitialized) return
        if (!AppSettings.isConfigured) {
            log.w { "AuthEnvironment init skipped: AppSettings not configured" }
            return
        }

        val settings = AppSettings.getSettings()
        val refresher: TokenRefresher = AzureB2CTokenRefresher(
            httpClient = sharedOkHttp,
            config = AzureAuthConfig(
                tokenEndpoint = settings.backend.auth.tokenEndpoint,
                clientId = settings.backend.auth.clientId,
                scope = settings.backend.auth.scope,
                clockSkewMs = settings.backend.auth.clockSkewMs,
            )
        )

        AuthEnvironment.ensureInitialized(
            appContext = applicationContext,
            refresher = refresher,
            onAuthRequired = {
                log.w { "Auth required inside UploadWorker" }
            }
        )
    }
}
