package com.skybolt.core.facade

import android.content.Context
import androidx.work.Constraints
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.workDataOf
import com.skybolt.BuildConfig
import com.skybolt.azureblob.auth.AzureAuthConfig
import com.skybolt.azureblob.auth.AzureB2CTokenRefresher
import com.skybolt.core.bg.UploadWorker
import com.skybolt.core.config.AppSettings
import com.skybolt.core.config.CloudUploadSettings
import com.skybolt.core.config.DataStoreSettingsPersistence
import com.skybolt.core.events.Events
import com.skybolt.core.net.NetworkWatcher
import com.skybolt.core.storage.SessionRepository
import com.skybolt.core.storage.NewItem
import com.skybolt.core.storage.SessionOptions
import com.skybolt.core.storage.SessionsIndex
import com.skybolt.core.storage.DataStoreSession
import com.skybolt.core.upload.api.SessionConfig
import com.skybolt.core.upload.api.SessionProgress
import com.skybolt.core.upload.api.UploadStatus
import com.skybolt.core.util.logger
import com.skybolt.proto.UploadSessionState.SessionStatus
import com.skybolt.core.auth.AuthEnvironment
import com.skybolt.core.auth.TokenRefresher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicLong
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.delay
import okhttp3.ConnectionPool
import okhttp3.ConnectionSpec
import okhttp3.OkHttpClient
import java.util.concurrent.TimeUnit
import androidx.core.net.toUri
import androidx.datastore.dataStoreFile
import com.skybolt.core.events.SkyboltEvent
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.map

/**
 * Main facade for Skybolt upload functionality.
 * Coordinates configuration, session management, and background work scheduling.
 * 
 * This is the primary entry point for all native upload operations.
 */
object SkyboltManager {
    private val log by logger()
    private val initialized = AtomicBoolean(false)
    private val initLock = Any()
    
    private lateinit var appContext: Context
    private lateinit var sessionRepository: SessionRepository
    private lateinit var sessionsIndex: SessionsIndex
    private lateinit var settingsPersistence: DataStoreSettingsPersistence
    private lateinit var workManager: WorkManager
    private var networkWatcher: NetworkWatcher? = null
    
    // Coroutine scope for auto-resume operations
    private val managerScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private val pausedSessionsForNetwork = mutableSetOf<String>()
    private val pausedSessionsForAuth = mutableSetOf<String>()
    private val lastAuthRequiredTime = AtomicLong(0)
    private const val AUTH_REQUIRED_DEBOUNCE_MS = 2000L

    @Volatile
    internal var enqueueSessionOverride: (suspend (String) -> Unit)? = null

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

    /**
     * Initialize the manager with application context.
     * Must be called before any other operations.
     * Safe to call multiple times (idempotent in production, resets in development).
     */
    fun initialize(context: Context) {
        synchronized(initLock) {
            // In development (Fast Refresh), allow re-initialization
            // Check if already initialized and just update event sink connection
            if (initialized.get()) {
                log.w { "SkyboltManager already initialized (development mode or module reload)" }
                return
            }

            initialized.set(true)
            appContext = context.applicationContext
            sessionRepository = SessionRepository(appContext)
            sessionsIndex = SessionsIndex(appContext)
            settingsPersistence = DataStoreSettingsPersistence(appContext)
            workManager = WorkManager.getInstance(appContext)
            
            // Start network watcher for auto-resume
            networkWatcher = NetworkWatcher(appContext).apply {
                start()
            }
            
            // Start auto-resume coroutine
            startAutoResumeMonitor()
            
            // Recover any pending sessions from previous app session
            managerScope.launch {
                restorePersistedConfigurationIfNeeded()
                recoverPendingSessions()
            }
            
            log.i { "SkyboltManager initialized with NetworkWatcher and auto-resume" }
        }
    }
    
    /**
     * Cleanup resources for development mode (Fast Refresh).
     * Does NOT cancel active uploads, only cleans up listeners and watchers.
     * Call this in OnDestroy to prevent memory leaks during development.
     */
    fun cleanupForDevelopment() {
        log.d { "Cleaning up SkyboltManager for development reload..." }
        
        // Stop network watcher to prevent stale callbacks
        try {
            networkWatcher?.stop()
            networkWatcher = null
        } catch (e: Exception) {
            log.w(e) { "Failed to stop network watcher" }
        }
        
        // Clear tracking sets (they'll be rebuilt from DataStore on next init)
        synchronized(pausedSessionsForNetwork) {
            pausedSessionsForNetwork.clear()
        }
        synchronized(pausedSessionsForAuth) {
            pausedSessionsForAuth.clear()
        }
        
        // Note: We DON'T cancel managerScope or WorkManager jobs
        // Those should continue running in the background
        
        log.i { "SkyboltManager cleanup complete (uploads still running)" }
    }

    internal fun clearTestOverrides() {
        enqueueSessionOverride = null
    }
    
    /**
     * Ensure manager is initialized.
     */
    private fun ensureInitialized() {
        check(initialized.get()) {
            "SkyboltManager not initialized. Call initialize(context) first."
        }
    }
    
    // ========================================================================
    // Configuration
    // ========================================================================
    
    /**
     * Configure Skybolt with cloud upload settings.
     * Must be called before starting any uploads.
     * 
     * @throws IllegalArgumentException if settings are invalid
     * @throws IllegalStateException if manager not initialized
     */
    suspend fun configure(settings: CloudUploadSettings) = withContext(Dispatchers.IO) {
        ensureInitialized()

        log.i { "Configuring Skybolt: env=${settings.environment}, version=${settings.version}" }

        // Validate and store settings
        AppSettings.configure(settings)
        settingsPersistence.save(settings)

        initializeAuthEnvironment(settings)

        log.i { "Skybolt configuration complete" }
    }
    
    // ========================================================================
    // Session Management
    // ========================================================================
    
    /**
     * Initialize a new upload session.
     * Creates session state and persists to storage.
     *
     * @throws IllegalStateException if not configured
     */
    suspend fun initializeSession(config: SessionConfig) = withContext(Dispatchers.IO) {
        ensureInitialized()
        require(AppSettings.isConfigured) { "Skybolt not configured. Call configure() first." }
        
        log.i { "Initializing session: ${config.sessionId}, files=${config.items.size}" }
        
        // Create session in repository
        sessionRepository.createOrLoadSession(
            sessionId = config.sessionId,
            items = config.items.map { item ->
                NewItem(
                    clientItemId = item.clientItemId,
                    localUri = item.localUri.toUri(),
                    blobName = item.blobName,
                    contentType = item.contentType,
                    totalBytes = item.sizeBytes,
                    md5Hex = item.md5Hex,
                    blockMd5Base64 = item.blockMd5B64,
                    metadata = item.metadata
                )
            },
            options = SessionOptions(
                maxParallelFiles = config.options.maxParallelFiles,
                maxParallelChunks = config.options.maxParallelChunks,
                chunkSizeBytes = config.options.chunkSizeBytes,
                requiresWiFi = config.options.requiresWiFi,
                allowsCellular = config.options.allowsCellular,
                lowPowerModeOkay = config.options.lowPowerModeOkay
            )
        )
        
        log.i { "Session initialized: ${config.sessionId}" }
    }
    
    /**
     * Start an initialized upload session.
     * Enqueues WorkManager job to perform upload in background.
     */
    suspend fun startSession(sessionId: String) = withContext(Dispatchers.IO) {
        ensureInitialized()
        require(sessionId.isNotBlank()) { "sessionId cannot be blank" }
        
        log.i { "Starting session: $sessionId" }

        enqueueSessionOverride?.let { override ->
            override(sessionId)
            log.i { "Session enqueued through test override: $sessionId" }
            return@withContext
        }
        
        // Get session to validate it exists and get options
        val session = sessionRepository.load(sessionId)
        
        // Build constraints from session options
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(
                if (session.requiresWifi) NetworkType.UNMETERED 
                else NetworkType.CONNECTED
            )
            .setRequiresBatteryNotLow(!session.lowPowerModeOkay)
            .build()
        
        // Create work request
        val workRequest = OneTimeWorkRequestBuilder<UploadWorker>()
            .setInputData(workDataOf(UploadWorker.KEY_SESSION_ID to sessionId))
            .setConstraints(constraints)
            .addTag(sessionId)
            .addTag("skybolt-upload")
            .build()
        
        // Enqueue work
        workManager.enqueue(workRequest)

        log.i { "[DIAG] Session enqueued: $sessionId, workId=${workRequest.id}, networkType=${constraints.requiredNetworkType}" }
    }
    
    /**
     * Pause an active upload session.
     */
    suspend fun pauseSession(sessionId: String) = withContext(Dispatchers.IO) {
        ensureInitialized()
        require(sessionId.isNotBlank()) { "sessionId cannot be blank" }
        
        log.i { "Pausing session: $sessionId" }
        
        // Cancel work
        workManager.cancelAllWorkByTag(sessionId)
        
        // Flush coalescer to ensure all pending writes are persisted
        sessionRepository.flushCoalescer(sessionId)
        
        // Update session status
        sessionRepository.setSessionStatus(sessionId, SessionStatus.PAUSED)
        
        // Emit event
        Events.emit(SkyboltEvent.SessionPaused(sessionId = sessionId))

        log.i { "Session paused: $sessionId" }
    }
    
    /**
     * Resume a paused upload session.
     */
    suspend fun resumeSession(sessionId: String) = withContext(Dispatchers.IO) {
        ensureInitialized()
        require(sessionId.isNotBlank()) { "sessionId cannot be blank" }
        
        log.i { "Resuming session: $sessionId" }
        
        // Restart the session (re-enqueue work)
        startSession(sessionId)
        
        // Emit event
        Events.emit(SkyboltEvent.SessionResumed(sessionId = sessionId))
        
        log.i { "Session resumed: $sessionId" }
    }
    
    /**
     * Cancel an upload session.
     * Stops all work and cleans up resources.
     */
    suspend fun cancelSession(sessionId: String) = withContext(Dispatchers.IO) {
        ensureInitialized()
        require(sessionId.isNotBlank()) { "sessionId cannot be blank" }
        
        log.i { "Canceling session: $sessionId" }
        
        // Cancel work
        workManager.cancelAllWorkByTag(sessionId)
        
        // Flush coalescer to ensure all pending writes are persisted
        sessionRepository.flushCoalescer(sessionId)
        
        // Mark session as canceled
        sessionRepository.setSessionStatus(sessionId, SessionStatus.CANCELED)
        
        // Emit event
        Events.emit(SkyboltEvent.SessionCanceled(sessionId = sessionId))
        
        log.i { "Session canceled: $sessionId" }
    }
    
    // ========================================================================
    // Session Queries
    // ========================================================================
    
    /**
     * Get current progress for a session.
     * Returns null if session doesn't exist.
     */
    suspend fun getSessionProgress(sessionId: String): SessionProgress? = withContext(Dispatchers.IO) {
        ensureInitialized()
        require(sessionId.isNotBlank()) { "sessionId cannot be blank" }
        
        val session = try {
            sessionRepository.load(sessionId)
        } catch (e: Exception) {
            log.w(e) { "Failed to load session: $sessionId" }
            return@withContext null
        }
        
        // Calculate uploaded bytes from items
        val uploadedBytes = session.itemsList.sumOf { it.uploadedBytes }
        val completedFiles = session.itemsList.count { 
            it.status == com.skybolt.proto.ItemRecord.Status.COMPLETED
        }
        
        // Convert to SessionProgress
        SessionProgress(
            sessionId = session.sessionId,
            status = convertStatus(session.status),
            totalFiles = session.itemsList.size,
            completedFiles = completedFiles,
            totalBytes = session.totalBytes,
            uploadedBytes = uploadedBytes,
            transferRateBps = session.metrics.peakBps.toLong().takeIf { it > 0 },
            estimatedCompletionMs = calculateEta(session.totalBytes, uploadedBytes, session.metrics.peakBps)
        )
    }
    
    /**
     * List all active session IDs.
     */
    suspend fun listActiveSessions(): List<String> = withContext(Dispatchers.IO) {
        ensureInitialized()
        sessionRepository
            .listSessionsByStatus(setOf(SessionStatus.PREPARING, SessionStatus.UPLOADING))
            .map { it.sessionId }
            .distinct()
    }
    
    /**
     * List all pending sessions (PAUSED or PREPARING state).
     * Returns detailed session information for UI display.
     * 
     * @return List of session details (sessionId, status, progress, etc.)
     */
    suspend fun listPendingSessions(): List<Map<String, Any>> = withContext(Dispatchers.IO) {
        ensureInitialized()
        
        log.d { "Listing pending sessions (via Index)..." }
        
        try {
            // Usar el índice optimizado del repositorio
            val pendingSessions = sessionRepository.listSessionsByStatus(
                setOf(SessionStatus.PAUSED, SessionStatus.PREPARING)
            )
            
            val result = pendingSessions.map { session ->
                mapOf<String, Any>(
                    "sessionId" to session.sessionId,
                    "status" to session.status.name,
                    "uploadedBytes" to session.uploadedBytes,
                    "totalBytes" to session.totalBytes,
                    "itemCount" to session.itemsList.size,
                    "startedAt" to (session.metrics?.startedAtMs ?: 0L),
                    "endedAt" to (session.metrics?.endedAtMs ?: 0L)
                )
            }
            
            log.d { "Found ${result.size} pending sessions" }
            result
            
        } catch (e: Exception) {
            log.e { "Failed to list pending sessions: ${e.message}" }
            emptyList()
        }
    }
    
    // ========================================================================
    // Maintenance
    // ========================================================================
    
    /**
     * Purge completed sessions older than specified time.
     * 
     * @param olderThanMs Time threshold in milliseconds (0 = all completed)
     * @return Number of sessions purged
     */
    suspend fun purgeCompletedSessions(olderThanMs: Long = 0): Int = withContext(Dispatchers.IO) {
        ensureInitialized()
        
        log.i { "Purging completed sessions older than ${olderThanMs}ms" }

        val completedSessions = sessionRepository.listSessionsByStatus(
            setOf(SessionStatus.COMPLETED, SessionStatus.CANCELED)
        )

        var count = 0
        val now = System.currentTimeMillis()

        for (session in completedSessions) {
            val sessionId = session.sessionId
            val endedAtMs = session.metrics.endedAtMs
            val fileLastModified = appContext
                .dataStoreFile("upload_session_${sessionId}.pb")
                .takeIf { it.exists() }
                ?.lastModified()
                ?: 0L
            val ageReference = if (endedAtMs > 0L) endedAtMs else fileLastModified

            val shouldPurge = olderThanMs <= 0L || (ageReference > 0L && now - ageReference > olderThanMs)
            if (!shouldPurge) continue

            runCatching { sessionRepository.flushCoalescer(sessionId) }
            sessionRepository.closeCoalescer(sessionId)
            DataStoreSession.drop(sessionId)
            val deleted = DataStoreSession.deleteFile(appContext, sessionId)
            sessionsIndex.remove(sessionId)
            synchronized(pausedSessionsForNetwork) { pausedSessionsForNetwork.remove(sessionId) }
            synchronized(pausedSessionsForAuth) { pausedSessionsForAuth.remove(sessionId) }

            if (deleted || ageReference > 0L) {
                count++
            }
        }
        
        log.i { "Purged $count sessions" }
        count
    }
    
    /**
     * Clean up temporary files created during upload process.
     * 
     * @return Number of files cleaned
     */
    suspend fun cleanupTempFiles(): Int = withContext(Dispatchers.IO) {
        ensureInitialized()
        
        log.i { "Cleaning up temp files" }

        val targetDirs = listOf(
            appContext.cacheDir,
            appContext.filesDir.resolve("tmp"),
            appContext.filesDir.resolve("skybolt-tmp")
        ).filter { it.exists() }

        val count = targetDirs.sumOf { dir ->
            dir.walkTopDown()
                .filter { file ->
                    file.isFile && (
                        file.name.startsWith("skybolt_") ||
                            file.name.endsWith(".tmp") ||
                            file.name.endsWith(".part")
                        )
                }
                .count { file -> file.delete() }
        }
        
        log.i { "Cleaned $count temp files" }
        count
    }
    
    // ========================================================================
    // Helper Methods
    // ========================================================================
    
    /**
     * Convert protobuf SessionStatus to UploadStatus enum.
     */
    private fun convertStatus(status: SessionStatus): UploadStatus = when (status) {
        SessionStatus.IDLE -> UploadStatus.IDLE
        SessionStatus.PREPARING -> UploadStatus.PREPARING
        SessionStatus.UPLOADING -> UploadStatus.UPLOADING
        SessionStatus.PAUSED -> UploadStatus.PAUSED
        SessionStatus.COMPLETED -> UploadStatus.COMPLETED
        SessionStatus.FAILED -> UploadStatus.FAILED
        SessionStatus.CANCELED -> UploadStatus.CANCELED
        else -> UploadStatus.IDLE
    }
    
    /**
     * Calculate estimated time to completion.
     */
    private fun calculateEta(totalBytes: Long, uploadedBytes: Long, bps: Double): Long? {
        val remaining = totalBytes - uploadedBytes
        if (remaining <= 0) return 0L
        
        if (bps <= 0) return null
        
        return (remaining * 1000.0 / bps).toLong()
    }
    
    // ========================================================================
    // Auto-Resume Logic
    // ========================================================================
    
    /**
     * Start background monitor for auto-resuming paused sessions.
     * Observes network connectivity and auth state changes.
     */
    private fun startAutoResumeMonitor() {
        val watcher = networkWatcher ?: return

        managerScope.launch {
            watcher.state
                .map { it.isConnected }
                .distinctUntilChanged()    // solo cuando cambia true/false
                .collect { isConnected ->
                    if (isConnected) {
                        log.i { "Network restored, checking for auto-resume..." }
                        delay(1000)
                        autoResumePausedSessions(reason = "network")
                    }
                }
        }
    }
    
    /**
     * Recover pending sessions from previous app session.
     * Called during initialization to restore upload state after app restart.
     * 
     * Sessions in UPLOADING state are converted to PAUSED (inconsistent state).
     * Sessions in PAUSED state are tracked for auto-resume.
     */
    private suspend fun recoverPendingSessions(): Pair<Int, Int> = withContext(Dispatchers.IO) {
        log.i { "Recovering pending sessions from DataStore..." }
        
        try {
            // Get app's DataStore directory
            val dataStoreDir = appContext.filesDir.resolve("datastore")
            if (!dataStoreDir.exists()) {
                log.i { "No DataStore directory found, no sessions to recover" }
                return@withContext 0 to 0
            }
            
            // List all session files (upload_session_*.pb)
            val sessionFiles = dataStoreDir.listFiles { file ->
                file.name.startsWith("upload_session_") && file.name.endsWith(".pb")
            } ?: emptyArray()
            
            if (sessionFiles.isEmpty()) {
                log.i { "No session files found" }
                return@withContext 0 to 0
            }
            
            log.i { "Found ${sessionFiles.size} session files to check" }
            
            var recoveredCount = 0
            var pausedCount = 0
            
            // Load each session and check its state
            sessionFiles.forEach { file ->
                try {
                    // Extract session ID from filename (upload_session_<id>.pb)
                    val sessionId = file.name
                        .removePrefix("upload_session_")
                        .removeSuffix(".pb")
                    
                    // Load session state
                    val session = sessionRepository.load(sessionId)
                    sessionsIndex.upsert(sessionId, status = session.status.name)
                    
                    when (session.status) {
                        SessionStatus.UPLOADING -> {
                            // Inconsistent state - app was killed during upload
                            log.w { "Session $sessionId in UPLOADING state, marking as PAUSED" }
                            sessionRepository.setSessionStatus(sessionId, SessionStatus.PAUSED)
                            sessionsIndex.touch(sessionId, status = SessionStatus.PAUSED.name)

                            Events.emit(SkyboltEvent.UploadStateChange(
                                sessionId = sessionId,
                                newState = "PAUSED",
                                oldState = "UPLOADING",
                                reason = "app_restart"
                            ))

                            // Track for auto-resume
                            trackNetworkPause(sessionId)
                            pausedCount++
                        }
                        
                        SessionStatus.PAUSED -> {
                            // Valid paused state - track for auto-resume
                            log.i { "Session $sessionId in PAUSED state, tracking for auto-resume" }
                            trackNetworkPause(sessionId)
                            pausedCount++
                        }
                        
                        SessionStatus.COMPLETED,
                        SessionStatus.FAILED,
                        SessionStatus.CANCELED -> {
                            // Terminal states - no action needed
                            log.d { "Session $sessionId in terminal state: ${session.status}" }
                        }
                        
                        SessionStatus.IDLE,
                        SessionStatus.PREPARING -> {
                            // Not started yet - no action needed
                            log.d { "Session $sessionId not started: ${session.status}" }
                        }
                        
                        else -> {
                            log.w { "Session $sessionId has unknown status: ${session.status}" }
                        }
                    }
                    
                    recoveredCount++
                    
                } catch (e: Exception) {
                    log.e { "Failed to recover session from file ${file.name}: ${e.message}" }
                }
            }
            
            log.i { "Session recovery complete: $recoveredCount scanned, $pausedCount tracked for auto-resume" }

            Events.emit(SkyboltEvent.UploadRecoveryComplete(
                totalScanned = recoveredCount,
                pendingCount = pausedCount
            ))

            recoveredCount to pausedCount
            
        } catch (e: Exception) {
            log.e { "Failed to recover pending sessions: ${e.message}" }
            0 to 0
        }
    }
    
    /**
     * Track session paused due to network issues.
     */
    fun trackNetworkPause(sessionId: String) {
        synchronized(pausedSessionsForNetwork) {
            pausedSessionsForNetwork.add(sessionId)
            log.d { "Tracked network pause for session: $sessionId" }
        }
    }
    
    /**
     * Track session paused due to auth expiration.
     */
    fun trackAuthPause(sessionId: String) {
        synchronized(pausedSessionsForAuth) {
            pausedSessionsForAuth.add(sessionId)
            log.d { "Tracked auth pause for session: $sessionId" }
        }
    }
    
    /**
     * Notify that authentication has been refreshed.
     * Triggers auto-resume for auth-paused sessions.
     */
    suspend fun notifyAuthRefreshed() = withContext(Dispatchers.IO) {
        ensureInitialized()
        log.i { "Auth refreshed, auto-resuming auth-paused sessions..." }
        autoResumePausedSessions(reason = "auth")
    }
    
    /**
     * Resume all pending sessions (PAUSED or PREPARING state).
     * Useful for batch resuming after app restart or user action.
     * 
     * @return Number of sessions resumed
     */
    suspend fun resumeAllPending(): Int = withContext(Dispatchers.IO) {
        ensureInitialized()
        log.i { "Resuming all pending sessions..." }
        
        try {
            // Get all pending sessions
            val pendingSessions = listPendingSessions()
            
            if (pendingSessions.isEmpty()) {
                log.d { "No pending sessions to resume" }
                return@withContext 0
            }
            
            log.i { "Found ${pendingSessions.size} pending sessions to resume" }
            
            var resumedCount = 0
            var failedCount = 0
            
            // Resume each session
            for (sessionMap in pendingSessions) {
                val sessionId = sessionMap["sessionId"] as? String
                if (sessionId == null) {
                    log.w { "Skipping session with missing ID" }
                    failedCount++
                    continue
                }
                
                try {
                    log.d { "Resuming session: $sessionId" }
                    resumeSession(sessionId)
                    resumedCount++
                } catch (e: Exception) {
                    log.w(e) { "Failed to resume session: $sessionId" }
                    failedCount++
                }
            }
            
            log.i { "Resume all complete: $resumedCount resumed, $failedCount failed" }

            // Emit event with results
            Events.emit(SkyboltEvent.UploadResumeAllComplete(
                totalPending = pendingSessions.size,
                resumed = resumedCount,
                failed = failedCount
            ))

            resumedCount
            
        } catch (e: Exception) {
            log.e(e) { "Failed to resume all pending sessions" }
            0
        }
    }

    /**
     * Local-only helper to trigger recovery flow from tests.
     * Simulates app restart/process recovery without cloud dependencies.
     */
    suspend fun runRecoveryPassForTesting(): Map<String, Int> = withContext(Dispatchers.IO) {
        ensureInitialized()
        val (totalScanned, pendingCount) = recoverPendingSessions()
        mapOf(
            "totalScanned" to totalScanned,
            "pendingCount" to pendingCount,
        )
    }

    /**
     * Local-only helper to trigger auto-resume logic from tests.
     */
    suspend fun runAutoResumePassForTesting(reason: String): Map<String, Int> = withContext(Dispatchers.IO) {
        ensureInitialized()
        val resumed = autoResumePausedSessions(reason)
        mapOf("resumed" to resumed)
    }
    
    /**
     * Auto-resume all sessions paused for the specified reason.
     */
    private suspend fun autoResumePausedSessions(reason: String): Int = withContext(Dispatchers.IO) {
        log.d { "Auto-resume triggered for reason: $reason" }
        val sessionsToResume = synchronized(when (reason) {
            "network" -> pausedSessionsForNetwork
            "auth" -> pausedSessionsForAuth
            else -> {
                log.w { "Unknown auto-resume reason: $reason" }
                return@withContext 0
            }
        }) {
            val sessions = when (reason) {
                "network" -> pausedSessionsForNetwork.toList()
                "auth" -> pausedSessionsForAuth.toList()
                else -> emptyList()
            }
            
            // Clear the tracking set
            when (reason) {
                "network" -> pausedSessionsForNetwork.clear()
                "auth" -> pausedSessionsForAuth.clear()
            }
            
            sessions
        }
        
        if (sessionsToResume.isEmpty()) {
            log.d { "No sessions to auto-resume for reason: $reason" }
            return@withContext 0
        }
        
        log.i { "Auto-resuming ${sessionsToResume.size} sessions (reason: $reason)" }
        
        var successCount = 0
        var failedCount = 0
        
        for (sessionId in sessionsToResume) {
            try {
                // Verify session is still paused before resuming
                val session = sessionRepository.load(sessionId)
                if (session.status == SessionStatus.PAUSED) {
                    log.i { "Auto-resuming session: $sessionId" }
                    resumeSession(sessionId)
                    successCount++
                } else {
                    log.d { "Session $sessionId no longer paused (status=${session.status}), skipping" }
                }
            } catch (e: Exception) {
                log.w(e) { "Failed to auto-resume session: $sessionId" }
                failedCount++
            }
        }
        
        log.i { "Auto-resume complete for reason: $reason (success=$successCount, failed=$failedCount)" }
        successCount
    }

    private suspend fun handleAuthRequired() = withContext(Dispatchers.IO) {
        ensureInitialized()

        val now = System.currentTimeMillis()
        val last = lastAuthRequiredTime.get()
        if (now - last < AUTH_REQUIRED_DEBOUNCE_MS) {
            log.d { "Debouncing auth:required event" }
            return@withContext
        }
        lastAuthRequiredTime.set(now)

        log.w { "Auth required from AuthManager (tokens missing/expired or refresh failed)" }

        // Puedes reutilizar la función existente para listar sesiones pendientes
        val pendingSessions = try {
            listPendingSessions()
        } catch (e: Exception) {
            log.e(e) { "Failed to get pending sessions for auth:required" }
            emptyList()
        }

        val pendingIds = pendingSessions
            .mapNotNull { it["sessionId"] as? String }
            .distinct()


        // Emitimos evento global para JS
        Events.emit(SkyboltEvent.AuthRequired(
            sessionId = null,
            pendingSessions = pendingIds
        ))

        log.i { "Emitted auth:required (pendingSessions=${pendingIds.size})" }
    }

    private suspend fun restorePersistedConfigurationIfNeeded() = withContext(Dispatchers.IO) {
        if (AppSettings.isConfigured) return@withContext

        val persisted = runCatching { settingsPersistence.load() }
            .getOrNull()
            ?: return@withContext

        AppSettings.configure(persisted)
        initializeAuthEnvironment(persisted)
        log.i { "Restored persisted Skybolt configuration" }
    }

    private suspend fun initializeAuthEnvironment(settings: CloudUploadSettings) {
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
            appContext = appContext,
            refresher = refresher,
            onAuthRequired = {
                managerScope.launch {
                    handleAuthRequired()
                }
            }
        )
    }
}
