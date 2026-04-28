package expo.modules.skybolt

import androidx.core.net.toUri
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.skybolt.azureblob.crypto.FastMD5
import expo.modules.skybolt.core.bridge.ErrorMapper
import expo.modules.skybolt.core.config.CloudUploadSettings
import expo.modules.skybolt.core.events.Events
import expo.modules.skybolt.core.events.NativeEventSink
import expo.modules.skybolt.core.facade.SkyboltManager
import expo.modules.skybolt.core.upload.api.SessionConfig
import expo.modules.skybolt.core.util.logger
import expo.modules.skybolt.core.util.LogLevel
import expo.modules.skybolt.core.util.AppLogger
import expo.modules.skybolt.core.auth.AuthEnvironment
import expo.modules.skybolt.core.auth.toAuthTokens
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Skybolt Native Module - Cloud upload functionality for React Native.
 * 
 * Provides comprehensive file upload capabilities with:
 * - Chunked uploads to Azure Blob Storage
 * - Background upload with WorkManager
 * - Progress tracking and event emission
 * - Automatic retry with exponential backoff
 * - SAS token management
 */
class SkyboltModule : Module() {
    private val log by logger()
    
    /**
     * Module definition with all exposed functions and events.
     */
    override fun definition() = ModuleDefinition {
        Name("Skybolt")
        
        // ====================================================================
        // Events
        // ====================================================================
        
        Events("onUploadEvent")
        
        // ====================================================================
        // Lifecycle
        // ====================================================================
        
        OnCreate {
            val ctx = appContext.reactContext?.applicationContext
                ?: error("Application context is null")

            val prefix = "Skybolt"
            val isDebug = BuildConfig.DEBUG
            val application = ctx as? android.app.Application
            val minLevel = if (isDebug) LogLevel.VERBOSE else LogLevel.WARN

            AppLogger.init(
                prefix = prefix,
                isDebug = isDebug,
                minLevel = minLevel,
                application = application
            )

            SkyboltManager.initialize(ctx)

            Events.setSink(NativeEventSink { type, payload ->
                val eventData = buildMap<String, Any?> {
                    put("type", type)
                    putAll(payload)
                }
                sendEvent("onUploadEvent", eventData)
            })

            log.i { "Skybolt module created (event sink configured)" }
        }
        
        OnDestroy {
            // Clear event sink to prevent stale references
            Events.clear()
            
            // Cleanup development resources (Fast Refresh support)
            // This does NOT cancel uploads, only cleans up listeners
            SkyboltManager.cleanupForDevelopment()
            
            log.i { "Skybolt module destroyed (uploads continue in background)" }
        }
        
        // ====================================================================
        // Configuration
        // ====================================================================
        
        /**
         * Configure Skybolt with upload settings.
         * Must be called before starting any uploads.
         * 
         * @param settingsMap Configuration object from JavaScript
         */
        AsyncFunction("configure") Coroutine { settingsMap: Map<String, Any?> ->
            try {
                log.d { "configure() called with settings" }
                
                val settings = CloudUploadSettings.fromMap(settingsMap)
                SkyboltManager.configure(settings)
                
                log.i { "Skybolt configured successfully" }
            } catch (e: Exception) {
                log.e(e) { "Configuration failed" }
                throw IllegalArgumentException("Configuration failed: ${e.message}", e)
            }
        }
        
        // ====================================================================
        // Session Management
        // ====================================================================
        
        /**
         * Initialize a new upload session.
         * Creates session state and prepares for upload.
         * 
         * @param configMap Session configuration from JavaScript
         */
        AsyncFunction("initializeSession") Coroutine { configMap: Map<String, Any?> ->
            try {
                log.d { "initializeSession() called" }
                
                val config = SessionConfig.fromJsMap(configMap)
                SkyboltManager.initializeSession(config)
                
                log.i { "Session initialized: ${config.sessionId}" }
            } catch (e: Exception) {
                log.e(e) { "Session initialization failed" }
                throw IllegalArgumentException("Session initialization failed: ${e.message}", e)
            }
        }
        
        /**
         * Start an initialized upload session.
         * Begins uploading files in background.
         * 
         * @param sessionId Unique session identifier
         */
        AsyncFunction("startSession") Coroutine { sessionId: String ->
            try {
                require(sessionId.isNotBlank()) { "sessionId cannot be blank" }
                log.d { "startSession() called: $sessionId" }
                
                SkyboltManager.startSession(sessionId)
                
                log.i { "Session started: $sessionId" }
            } catch (e: Exception) {
                log.e(e) { "Failed to start session: $sessionId" }
                throw IllegalArgumentException("Failed to start session: ${e.message}", e)
            }
        }
        
        /**
         * Pause an active upload session.
         * 
         * @param sessionId Unique session identifier
         */
        AsyncFunction("pauseSession") Coroutine { sessionId: String ->
            try {
                require(sessionId.isNotBlank()) { "sessionId cannot be blank" }
                log.d { "pauseSession() called: $sessionId" }
                
                SkyboltManager.pauseSession(sessionId)
                
                log.i { "Session paused: $sessionId" }
            } catch (e: Exception) {
                log.e(e) { "Failed to pause session: $sessionId" }
                throw IllegalArgumentException("Failed to pause session: ${e.message}", e)
            }
        }
        
        /**
         * Resume a paused upload session.
         * 
         * @param sessionId Unique session identifier
         */
        AsyncFunction("resumeSession") Coroutine { sessionId: String ->
            try {
                require(sessionId.isNotBlank()) { "sessionId cannot be blank" }
                log.d { "resumeSession() called: $sessionId" }
                
                SkyboltManager.resumeSession(sessionId)
                
                log.i { "Session resumed: $sessionId" }
            } catch (e: Exception) {
                log.e(e) { "Failed to resume session: $sessionId" }
                throw IllegalArgumentException("Failed to resume session: ${e.message}", e)
            }
        }
        
        /**
         * Cancel an upload session.
         * Stops upload and cleans up resources.
         * 
         * @param sessionId Unique session identifier
         */
        AsyncFunction("cancelSession") Coroutine { sessionId: String ->
            try {
                require(sessionId.isNotBlank()) { "sessionId cannot be blank" }
                log.d { "cancelSession() called: $sessionId" }
                
                SkyboltManager.cancelSession(sessionId)
                
                log.i { "Session canceled: $sessionId" }
            } catch (e: Exception) {
                log.e(e) { "Failed to cancel session: $sessionId" }
                throw IllegalArgumentException("Failed to cancel session: ${e.message}", e)
            }
        }
        
        // ====================================================================
        // Session Queries
        // ====================================================================
        
        /**
         * Get current progress for a session.
         * Returns null if session doesn't exist.
         * 
         * @param sessionId Unique session identifier
         * @return Progress map or null
         */
        AsyncFunction("getSessionProgress") Coroutine { sessionId: String ->
            try {
                require(sessionId.isNotBlank()) { "sessionId cannot be blank" }
                log.d { "getSessionProgress() called: $sessionId" }
                
                val progress = SkyboltManager.getSessionProgress(sessionId)
                progress?.toJsMap()
            } catch (e: Exception) {
                log.e(e) { "Failed to get session progress: $sessionId" }
                null
            }
        }
        
        /**
         * List all active (non-terminal) session IDs.
         * 
         * @return List of session IDs
         */
        AsyncFunction("listActiveSessions") Coroutine { ->
            try {
                log.d { "listActiveSessions() called" }
                
                SkyboltManager.listActiveSessions()
            } catch (e: Exception) {
                log.e(e) { "Failed to list active sessions" }
                emptyList<String>()
            }
        }
        
        /**
         * List all pending sessions (PAUSED or PREPARING state).
         * Used to show recoverable uploads in UI after app restart.
         * 
         * @return List of session details
         */
        AsyncFunction("listPendingSessions") Coroutine { ->
            try {
                log.d { "listPendingSessions() called" }
                
                SkyboltManager.listPendingSessions()
            } catch (e: Exception) {
                log.e(e) { "Failed to list pending sessions" }
                emptyList<Map<String, Any>>()
            }
        }
        
        /**
         * Notify that authentication has been refreshed.
         * Triggers auto-resume for sessions paused due to auth expiration.
         */
        AsyncFunction("notifyAuthRefreshed") Coroutine { ->
            try {
                log.d { "notifyAuthRefreshed() called" }
                
                SkyboltManager.notifyAuthRefreshed()
                
                log.i { "Auth refresh notification processed" }
            } catch (e: Exception) {
                log.e(e) { "Failed to notify auth refresh" }
                throw e
            }
        }
        
        /**
         * Resume all pending sessions (PAUSED or PREPARING state).
         * Useful for batch resuming after app restart or user action.
         * 
         * @return Number of sessions resumed
         */
        AsyncFunction("resumeAllPending") Coroutine { ->
            try {
                log.d { "resumeAllPending() called" }
                
                val count = SkyboltManager.resumeAllPending()
                
                log.i { "Resumed $count pending sessions" }
                count
            } catch (e: Exception) {
                log.e(e) { "Failed to resume all pending sessions" }
                0
            }
        }
        
        // ====================================================================
        // Maintenance
        // ====================================================================
        
        /**
         * Purge completed sessions older than specified time.
         * 
         * @param olderThanMs Time threshold in milliseconds (default: 0 = all)
         * @return Number of sessions purged
         */
        AsyncFunction("purgeCompletedSessions") Coroutine { olderThanMs: Double? ->
            try {
                val threshold = olderThanMs?.toLong() ?: 0L
                log.d { "purgeCompletedSessions() called: threshold=${threshold}ms" }
                
                SkyboltManager.purgeCompletedSessions(threshold)
            } catch (e: Exception) {
                log.e(e) { "Failed to purge sessions" }
                0
            }
        }
        
        /**
         * Clean up temporary files.
         * 
         * @return Number of files cleaned
         */
        AsyncFunction("cleanupTempFiles") Coroutine { ->
            try {
                log.d { "cleanupTempFiles() called" }
                
                SkyboltManager.cleanupTempFiles()
            } catch (e: Exception) {
                log.e(e) { "Failed to cleanup temp files" }
                0
            }
        }

        // ====================================================================
        // Authentication
        // ====================================================================

        /**
          * Update authentication tokens from JavaScript.
          * 
          * @param map Auth tokens map
        */
        AsyncFunction("setAuthTokens") Coroutine { map: Map<String, Any?> ->
            val tokens = map.toAuthTokens()
            AuthEnvironment.manager.updateTokens(tokens)
            log.i { "Auth tokens updated from JS" }
        }

        /**
          * Get valid access token, refreshing if needed.
          * Returns null if no valid token is available.
        */
        AsyncFunction("getValidAccessToken") Coroutine { ->
            withContext(Dispatchers.IO) {
                AuthEnvironment.manager.getValidAccessTokenOrNull()
            }
        }

        /**
          * Clear stored authentication tokens.
        */
        AsyncFunction("clearAuthTokens") Coroutine { ->
            AuthEnvironment.manager.clear()
            log.i { "Auth tokens cleared" }
        }

        // ====================================================================
        // Utilities
        // ====================================================================
        
        /**
         * Extract MD5 hashes from local files.
         * 
         * @param fileUris Array of local file URIs
         * @return Array of MD5 result objects
         */
        AsyncFunction("extractMD5FromFiles") Coroutine { fileUris: List<String> ->
            try {
                require(fileUris.isNotEmpty()) { "fileUris cannot be empty" }
                log.d { "extractMD5FromFiles() called: count=${fileUris.size}" }
                
                val results = FastMD5.computeMd5HexBatch(
                    ctx = appContext.reactContext!!,
                    uris = fileUris
                )
                
                results.map { result ->
                    mapOf(
                        "uri" to result.uri,
                        "md5Hex" to result.md5Hex,
                        "sizeBytes" to result.sizeBytes,
                        "contentType" to result.contentType,
                        "lastModifiedMs" to result.lastModifiedMs
                    )
                }
            } catch (e: Exception) {
                log.e(e) { "Failed to extract MD5 hashes" }
                throw IllegalArgumentException("Failed to extract MD5: ${e.message}", e)
            }
        }
    }
}
