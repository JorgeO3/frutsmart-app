package com.skybolt.core.upload.api

/**
 * Type alias for session specification used in upload operations.
 * Points to SessionConfig for consistency.
 */
typealias SessionSpec = SessionConfig

/**
 * Upload status matching TypeScript UploadStatus type.
 * Represents the state of an entire upload session.
 */
enum class UploadStatus {
    IDLE,
    PREPARING,
    UPLOADING,
    PAUSED,
    COMPLETED,
    FAILED,
    CANCELED;

    companion object {
        fun fromString(value: String): UploadStatus = when (value.lowercase()) {
            "idle" -> IDLE
            "preparing" -> PREPARING
            "uploading" -> UPLOADING
            "paused" -> PAUSED
            "completed" -> COMPLETED
            "failed" -> FAILED
            "cancelled", "canceled" -> CANCELED
            else -> throw IllegalArgumentException("Invalid upload status: $value")
        }
    }

    fun toJsString(): String = name.lowercase()
}

/**
 * Item status matching TypeScript ItemStatus type.
 * Represents the state of an individual file within a session.
 */
enum class ItemStatus {
    PENDING,
    UPLOADING,
    COMPLETED,
    FAILED,
    CANCELED;

    companion object {
        fun fromString(value: String): ItemStatus = when (value.lowercase()) {
            "pending" -> PENDING
            "uploading" -> UPLOADING
            "completed" -> COMPLETED
            "failed" -> FAILED
            "cancelled", "canceled" -> CANCELED
            else -> throw IllegalArgumentException("Invalid item status: $value")
        }
        
        /**
         * Convert from Protobuf ItemRecord.Status to ItemStatus enum.
         */
        fun fromProto(protoStatus: com.skybolt.proto.ItemRecord.Status): ItemStatus = when (protoStatus) {
            com.skybolt.proto.ItemRecord.Status.PENDING -> PENDING
            com.skybolt.proto.ItemRecord.Status.UPLOADING -> UPLOADING
            com.skybolt.proto.ItemRecord.Status.COMPLETED -> COMPLETED
            com.skybolt.proto.ItemRecord.Status.FAILED -> FAILED
            com.skybolt.proto.ItemRecord.Status.CANCELED -> CANCELED
            else -> PENDING
        }
    }

    fun toJsString(): String = name.lowercase()
    
    /**
     * Convert to Protobuf ItemRecord.Status.
     */
    fun toProto(): com.skybolt.proto.ItemRecord.Status = when (this) {
        PENDING -> com.skybolt.proto.ItemRecord.Status.PENDING
        UPLOADING -> com.skybolt.proto.ItemRecord.Status.UPLOADING
        COMPLETED -> com.skybolt.proto.ItemRecord.Status.COMPLETED
        FAILED -> com.skybolt.proto.ItemRecord.Status.FAILED
        CANCELED -> com.skybolt.proto.ItemRecord.Status.CANCELED
    }
}

/**
 * Individual item progress information.
 * Matches TypeScript ItemProgress type.
 */
data class ItemProgress(
    val sessionId: String,
    val clientItemId: String,
    val bytesUploaded: Long,
    val totalBytes: Long,
    val blockIndex: Int? = null,
    val blockSize: Long? = null,
    val retries: Int = 0
) {
    /**
     * Convert to JS-compatible map.
     */
    fun toJsMap(): Map<String, Any?> = buildMap {
        put("sessionId", sessionId)
        put("clientItemId", clientItemId)
        put("bytesUploaded", bytesUploaded)
        put("totalBytes", totalBytes)
        blockIndex?.let { put("blockIndex", it) }
        blockSize?.let { put("blockSize", it) }
        if (retries > 0) put("retries", retries)
    }
}

/**
 * Session-level aggregate progress.
 * Matches TypeScript SessionProgress type.
 */
data class SessionProgress(
    val sessionId: String,
    val status: UploadStatus,
    val totalFiles: Int,
    val completedFiles: Int,
    val totalBytes: Long,
    val uploadedBytes: Long,
    val transferRateBps: Long? = null,
    val estimatedCompletionMs: Long? = null
) {
    /**
     * Convert to JS-compatible map.
     */
    fun toJsMap(): Map<String, Any?> = buildMap {
        put("sessionId", sessionId)
        put("status", status.toJsString())
        put("totalFiles", totalFiles)
        put("completedFiles", completedFiles)
        put("totalBytes", totalBytes)
        put("uploadedBytes", uploadedBytes)
        transferRateBps?.let { put("transferRateBps", it) }
        estimatedCompletionMs?.let { put("estimatedCompletionMs", it) }
    }
}

/**
 * File descriptor for upload session.
 * Matches TypeScript UploadItem type.
 */
data class ItemSpec(
    val clientItemId: String,
    val localUri: String,
    val blobName: String,
    val contentType: String,
    val sizeBytes: Long,
    val md5Hex: String? = null,
    val blockMd5B64: List<String>? = null,
    val metadata: Map<String, String> = emptyMap()
) {
    companion object {
        /**
         * Create from JS map.
         */
        fun fromJsMap(map: Map<String, Any?>): ItemSpec {
            val clientItemId = map["clientItemId"] as? String
                ?: throw IllegalArgumentException("clientItemId is required")
            val localUri = map["localUri"] as? String
                ?: throw IllegalArgumentException("localUri is required")
            val blobName = map["blobName"] as? String
                ?: throw IllegalArgumentException("blobName is required")
            val contentType = map["contentType"] as? String
                ?: throw IllegalArgumentException("contentType is required")
            val sizeBytes = (map["sizeBytes"] as? Number)?.toLong()
                ?: throw IllegalArgumentException("sizeBytes is required")

            val md5Hex = map["md5Hex"] as? String
            
            @Suppress("UNCHECKED_CAST")
            val blockMd5B64 = (map["blockMd5B64"] as? List<*>)?.filterIsInstance<String>()
            
            @Suppress("UNCHECKED_CAST")
            val metadata = (map["metadata"] as? Map<String, String>) ?: emptyMap()

            return ItemSpec(
                clientItemId = clientItemId,
                localUri = localUri,
                blobName = blobName,
                contentType = contentType,
                sizeBytes = sizeBytes,
                md5Hex = md5Hex,
                blockMd5B64 = blockMd5B64,
                metadata = metadata
            )
        }
    }
}

/**
 * Session initialization options.
 * Matches TypeScript StartOptions type.
 */
data class StartOptions(
    val maxParallelFiles: Int = 2,
    val maxParallelChunks: Int = 4,
    val chunkSizeBytes: Int = 4 * 1024 * 1024,
    val enableBackground: Boolean = true,
    val requiresWiFi: Boolean = false,
    val allowsCellular: Boolean = true,
    val lowPowerModeOkay: Boolean = true
) {
    companion object {
        /**
         * Create from JS map.
         */
        fun fromJsMap(map: Map<String, Any?>?): StartOptions {
            if (map == null) return StartOptions()
            
            return StartOptions(
                maxParallelFiles = (map["maxParallelFiles"] as? Number)?.toInt() ?: 2,
                maxParallelChunks = (map["maxParallelChunks"] as? Number)?.toInt() ?: 4,
                chunkSizeBytes = (map["chunkSizeBytes"] as? Number)?.toInt() ?: (4 * 1024 * 1024),
                enableBackground = (map["enableBackground"] as? Boolean) ?: true,
                requiresWiFi = (map["requiresWiFi"] as? Boolean) ?: false,
                allowsCellular = (map["allowsCellular"] as? Boolean) ?: true,
                lowPowerModeOkay = (map["lowPowerModeOkay"] as? Boolean) ?: true
            )
        }
    }
}

/**
 * Complete session configuration.
 * Matches TypeScript SessionConfig type.
 */
data class SessionConfig(
    val sessionId: String,
    val items: List<ItemSpec>,
    val options: StartOptions = StartOptions()
) {
    companion object {
        /**
         * Create from JS map.
         */
        fun fromJsMap(map: Map<String, Any?>): SessionConfig {
            val sessionId = map["sessionId"] as? String
                ?: throw IllegalArgumentException("sessionId is required")
            
            @Suppress("UNCHECKED_CAST")
            val itemsList = (map["items"] as? List<Map<String, Any?>>)
                ?: throw IllegalArgumentException("items is required")
            
            val items = itemsList.map { ItemSpec.fromJsMap(it) }
            
            @Suppress("UNCHECKED_CAST")
            val optionsMap = map["options"] as? Map<String, Any?>
            val options = StartOptions.fromJsMap(optionsMap)

            return SessionConfig(
                sessionId = sessionId,
                items = items,
                options = options
            )
        }
    }
}
