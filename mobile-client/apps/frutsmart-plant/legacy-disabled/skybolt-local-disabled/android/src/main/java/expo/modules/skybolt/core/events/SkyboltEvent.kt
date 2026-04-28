package expo.modules.skybolt.core.events

sealed class SkyboltEvent {
    abstract val type: EventType
    abstract fun payload(): Map<String, Any?>

    // ---- Session ----

    data class SessionStarted(val sessionId: String) : SkyboltEvent() {
        override val type = EventType.SESSION_STARTED
        override fun payload() = mapOf(
            "sessionId" to sessionId
        )
    }

    data class SessionPaused(
        val sessionId: String,
        val reason: String? = null
    ) : SkyboltEvent() {
        override val type = EventType.SESSION_PAUSED
        override fun payload() = buildMap<String, Any?> {
            put("sessionId", sessionId)
            reason?.let { put("reason", it) }
        }
    }

    data class SessionResumed(
        val sessionId: String
    ) : SkyboltEvent() {
        override val type = EventType.SESSION_RESUMED
        override fun payload() = mapOf(
            "sessionId" to sessionId
        )
    }

    data class SessionCompleted(
        val sessionId: String
    ) : SkyboltEvent() {
        override val type = EventType.SESSION_COMPLETED
        override fun payload() = mapOf(
            "sessionId" to sessionId
        )
    }

    data class SessionCanceled(
        val sessionId: String
    ) : SkyboltEvent() {
        override val type = EventType.SESSION_CANCELED
        override fun payload() = mapOf(
            "sessionId" to sessionId
        )
    }

    data class SessionFailed(
        val sessionId: String,
        val errorCode: String,
        val errorMessage: String
    ) : SkyboltEvent() {
        override val type = EventType.SESSION_FAILED
        override fun payload() = mapOf(
            "sessionId" to sessionId,
            "errorCode" to errorCode,
            "errorMessage" to errorMessage
        )
    }

    // ---- Items ----

    data class ItemProgress(
        val sessionId: String,
        val clientItemId: String,
        val bytesUploaded: Long,
        val totalBytes: Long,
        val blockIndex: Int? = null,
        val blockSize: Long? = null,
        val retries: Int = 0
    ) : SkyboltEvent() {
        override val type = EventType.ITEM_PROGRESS
        override fun payload() = buildMap<String, Any?> {
            put("sessionId", sessionId)
            put("clientItemId", clientItemId)
            put("bytesUploaded", bytesUploaded)
            put("totalBytes", totalBytes)
            blockIndex?.let { put("blockIndex", it) }
            blockSize?.let { put("blockSize", it) }
            if (retries > 0) put("retries", retries)
        }
    }

    data class ItemCompleted(
        val sessionId: String,
        val clientItemId: String
    ) : SkyboltEvent() {
        override val type = EventType.ITEM_COMPLETED
        override fun payload() = mapOf(
            "sessionId" to sessionId,
            "clientItemId" to clientItemId
        )
    }

    data class ItemFailed(
        val sessionId: String,
        val clientItemId: String,
        val errorCode: String,
        val errorMessage: String
    ) : SkyboltEvent() {
        override val type = EventType.ITEM_FAILED
        override fun payload() = mapOf(
            "sessionId" to sessionId,
            "clientItemId" to clientItemId,
            "errorCode" to errorCode,
            "errorMessage" to errorMessage
        )
    }

    // ---- Auth ----

    data class AuthRequired(
        val sessionId: String? = null,
        val pendingSessions: List<String> = emptyList()
    ) : SkyboltEvent() {
        override val type = EventType.AUTH_REQUIRED
        override fun payload() = buildMap<String, Any?> {
            sessionId?.let { put("sessionId", it) }
            put("pendingSessions", pendingSessions)
        }
    }

    // ---- Errores ----

    data class ErrorForbidden(
        val sessionId: String,
        val clientItemId: String,
        val message: String
    ) : SkyboltEvent() {
        override val type = EventType.ERROR_FORBIDDEN
        override fun payload() = mapOf(
            "sessionId" to sessionId,
            "clientItemId" to clientItemId,
            "message" to message
        )
    }

    data class ErrorRateLimited(
        val sessionId: String,
        val clientItemId: String,
        val message: String,
        val retryAfterMs: Long
    ) : SkyboltEvent() {
        override val type = EventType.ERROR_RATE_LIMITED
        override fun payload() = mapOf(
            "sessionId" to sessionId,
            "clientItemId" to clientItemId,
            "message" to message,
            "retryAfterMs" to retryAfterMs
        )
    }

    data class ErrorThrottled(
        val sessionId: String,
        val clientItemId: String,
        val message: String,
        val retryAfterMs: Long
    ) : SkyboltEvent() {
        override val type = EventType.ERROR_THROTTLED
        override fun payload() = mapOf(
            "sessionId" to sessionId,
            "clientItemId" to clientItemId,
            "message" to message,
            "retryAfterMs" to retryAfterMs
        )
    }

    data class ErrorContract(
        val sessionId: String,
        val clientItemId: String,
        val message: String
    ) : SkyboltEvent() {
        override val type = EventType.ERROR_CONTRACT
        override fun payload() = mapOf(
            "sessionId" to sessionId,
            "clientItemId" to clientItemId,
            "message" to message
        )
    }

    data class ErrorNetwork(
        val sessionId: String,
        val clientItemId: String,
        val message: String,
        val attempt: Int
    ) : SkyboltEvent() {
        override val type = EventType.ERROR_NETWORK
        override fun payload() = mapOf(
            "sessionId" to sessionId,
            "clientItemId" to clientItemId,
            "message" to message,
            "attempt" to attempt
        )
    }

    data class ErrorChecksum(
        val sessionId: String,
        val clientItemId: String,
        val message: String
    ) : SkyboltEvent() {
        override val type = EventType.ERROR_CHECKSUM
        override fun payload() = mapOf(
            "sessionId" to sessionId,
            "clientItemId" to clientItemId,
            "message" to message
        )
    }

    data class ErrorFileAccess(
        val sessionId: String,
        val clientItemId: String,
        val message: String
    ) : SkyboltEvent() {
        override val type = EventType.ERROR_FILE_ACCESS
        override fun payload() = mapOf(
            "sessionId" to sessionId,
            "clientItemId" to clientItemId,
            "message" to message
        )
    }

    data class ErrorFatal(
        val sessionId: String?,
        val message: String,
        val stack: String?
    ) : SkyboltEvent() {
        override val type = EventType.ERROR_FATAL
        override fun payload() = buildMap<String, Any?> {
            sessionId?.let { put("sessionId", it) }
            put("message", message)
            stack?.let { put("stack", it) }
        }
    }

    // ---- SAS ----

    data class SasRequested(
        val sessionId: String,
        val blobNames: List<String>
    ) : SkyboltEvent() {
        override val type = EventType.SAS_REQUESTED
        override fun payload() = mapOf(
            "sessionId" to sessionId,
            "blobNames" to blobNames
        )
    }

    data class SasReceived(
        val sessionId: String,
        val blobNames: List<String>
    ) : SkyboltEvent() {
        override val type = EventType.SAS_RECEIVED
        override fun payload() = mapOf(
            "sessionId" to sessionId,
            "blobNames" to blobNames
        )
    }

    data class SasError(
        val sessionId: String,
        val errorCode: String,
        val errorMessage: String
    ) : SkyboltEvent() {
        override val type = EventType.SAS_ERROR
        override fun payload() = mapOf(
            "sessionId" to sessionId,
            "errorCode" to errorCode,
            "errorMessage" to errorMessage
        )
    }

    // ---- Upload meta ----

    data class UploadStateChange(
        val sessionId: String,
        val newState: String,
        val oldState: String,
        val reason: String? = null
    ) : SkyboltEvent() {
        override val type = EventType.UPLOAD_STATE_CHANGE
        override fun payload() = buildMap<String, Any?> {
            put("sessionId", sessionId)
            put("newState", newState)
            put("oldState", oldState)
            reason?.let { put("reason", it) }
        }
    }

    data class UploadRecoveryComplete(
        val totalScanned: Int,
        val pendingCount: Int
    ) : SkyboltEvent() {
        override val type = EventType.UPLOAD_RECOVERY_COMPLETE
        override fun payload() = mapOf(
            "totalScanned" to totalScanned,
            "pendingCount" to pendingCount
        )
    }

    data class UploadResumeAllComplete(
        val totalPending: Int,
        val resumed: Int,
        val failed: Int
    ) : SkyboltEvent() {
        override val type = EventType.UPLOAD_RESUME_ALL_COMPLETE
        override fun payload() = mapOf(
            "totalPending" to totalPending,
            "resumed" to resumed,
            "failed" to failed
        )
    }

    // ---- Debug ----

    data class Debug(
        val sessionId: String? = null,
        val message: String
    ) : SkyboltEvent() {
        override val type = EventType.DEBUG
        override fun payload() = buildMap<String, Any?> {
            sessionId?.let { put("sessionId", it) }
            put("message", message)
        }
    }
}
