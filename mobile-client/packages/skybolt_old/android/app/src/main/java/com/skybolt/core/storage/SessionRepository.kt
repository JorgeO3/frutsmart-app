package com.skybolt.core.storage

import android.content.Context
import android.net.Uri
import androidx.datastore.core.DataStore
import com.skybolt.core.util.logger
import com.skybolt.proto.ItemRecord
import com.skybolt.proto.UploadSessionState
import com.skybolt.proto.UploadSessionState.SessionStatus
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.util.concurrent.ConcurrentHashMap
import kotlin.apply
import kotlin.collections.forEach
import kotlin.collections.getOrPut
import kotlin.collections.set
import kotlin.collections.sumOf
import kotlin.let
import kotlin.ranges.until

/**
 * Repository for managing upload session state with optimized performance.
 *
 * Features:
 * - Write coalescing to reduce DataStore overhead
 * - O(1) item lookup with index caching
 * - Incremental byte tracking to avoid O(n) summations
 * - Automatic cleanup of inactive coalescers to prevent memory leaks
 */
class SessionRepository(
    private val appContext: Context,
    private val scope: CoroutineScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
) {

    private val log by logger()
    
    private val coalescers = ConcurrentHashMap<String, WriteCoalescer>()
    private val coalescerLastAccess = ConcurrentHashMap<String, Long>()
    private val itemIndexCache = ConcurrentHashMap<String, MutableMap<String, Int>>()
    private val sessionUploadedBytes = ConcurrentHashMap<String, Long>()
    private val stores = ConcurrentHashMap<String, DataStore<UploadSessionState>>()
    
    // Índice ligero para búsquedas rápidas
    private val sessionsIndex = SessionsIndex(appContext)


    private val cleanupJob = scope.launch {
        while (isActive) {
            delay(CLEANUP_INTERVAL_MS)
            cleanupInactiveCoalescers()
        }
    }

    companion object {
        private const val CLEANUP_INTERVAL_MS = 5 * 60 * 1000L
        private const val INACTIVITY_THRESHOLD_MS = 10 * 60 * 1000L
    }

    // --- Core Operations ---

    /**
     * Creates a new session or returns existing one (idempotent).
     */
    suspend fun createOrLoadSession(
        sessionId: String,
        items: List<NewItem>,
        options: SessionOptions
    ) = log.trace("createOrLoadSession") {
        log.d { "Creating/loading session: sessionId=$sessionId, itemCount=${items.size}" }
        
        dataStore(sessionId).updateData { current ->
            if (current.sessionId.isNotEmpty()) {
                log.d { "Session already exists: sessionId=$sessionId, status=${current.status}" }
                return@updateData current
            }
            
            val totalBytes = items.sumOf { it.totalBytes }
            log.i { "Creating new session: sessionId=$sessionId, totalBytes=$totalBytes, itemCount=${items.size}" }
            log.dFields {
                msg = "Session options"
                "maxParallelFiles" to options.maxParallelFiles
                "maxParallelChunks" to options.maxParallelChunks
                "chunkSize" to options.chunkSizeBytes
                "requiresWiFi" to options.requiresWiFi
            }

            current.toBuilder()
                .setSessionId(sessionId)
                .setStatus(SessionStatus.PREPARING)
                .setTotalBytes(totalBytes)
                .apply {
                    maxParallelFiles = options.maxParallelFiles
                    maxParallelChunks = options.maxParallelChunks
                    chunkSizeBytes = options.chunkSizeBytes
                    requiresWifi = options.requiresWiFi
                    allowsCellular = options.allowsCellular
                    lowPowerModeOkay = options.lowPowerModeOkay

                    items.forEach { item ->
                        addItems(item.toProto())
                    }
                }
                .build()
                .also { 
                    log.i { "Session created successfully: sessionId=$sessionId" }
                    // Actualizar índice
                    sessionsIndex.upsert(sessionId, status = SessionStatus.PREPARING.name)
                }
        }
    }

    /**
     * Updates session status.
     */
    suspend fun setSessionStatus(sessionId: String, status: SessionStatus) {
        log.d { "Setting session status: sessionId=$sessionId, status=$status" }
        
        dataStore(sessionId).updateData {
            it.toBuilder().setStatus(status).build()
        }
        // Actualizar índice
        sessionsIndex.touch(sessionId, status = status.name)
    }

    /**
     * Updates item progress with write coalescing for high-frequency updates.
     */
    suspend fun updateItemProgressCoalesced(
        sessionId: String,
        clientItemId: String,
        uploadedBytes: Long,
        nextBlockIndex: Int,
        totalBlocks: Int
    ) {
        log.iEvery(100, "progress") { 
            "Progress update: sessionId=$sessionId, item=$clientItemId, bytes=$uploadedBytes, block=$nextBlockIndex/$totalBlocks" 
        }
        
        getCoalescer(sessionId).submit {
            dataStore(sessionId).updateData { current ->
                val builder = current.toBuilder()
                val index = getItemIndex(sessionId, current, clientItemId)
                
                if (index == null) {
                    log.w { "Item not found in cache: sessionId=$sessionId, item=$clientItemId" }
                    return@updateData current
                }

                if (index >= builder.itemsCount) {
                    log.e { "Item index out of bounds: sessionId=$sessionId, index=$index, count=${builder.itemsCount}" }
                    return@updateData current
                }

                val item = builder.getItems(index)
                val byteDelta = uploadedBytes - item.uploadedBytes

                builder.setItems(index, item.toBuilder()
                    .setUploadedBytes(uploadedBytes)
                    .setNextBlockIndex(nextBlockIndex)
                    .setTotalBlocks(totalBlocks)
                    .setStatus(ItemRecord.Status.UPLOADING)
                    .build()
                )

                updateSessionBytes(sessionId, current.uploadedBytes, byteDelta, builder)
                builder.build()
            }
        }
    }

    /**
     * Marks an item as successfully uploaded.
     */
    suspend fun markItemCompleted(sessionId: String, clientItemId: String) {
        log.i { "Marking item completed: sessionId=$sessionId, item=$clientItemId" }
        
        dataStore(sessionId).updateData { current ->
            val builder = current.toBuilder()
            val index = getItemIndex(sessionId, current, clientItemId)
            
            if (index == null) {
                log.w { "Item not found when marking completed: sessionId=$sessionId, item=$clientItemId" }
                return@updateData current
            }

            if (index >= builder.itemsCount) {
                log.e { "Item index out of bounds when completing: sessionId=$sessionId, index=$index" }
                return@updateData current
            }

            val item = builder.getItems(index)
            val byteDelta = item.totalBytes - item.uploadedBytes

            builder.setItems(index, item.toBuilder()
                .setStatus(ItemRecord.Status.COMPLETED)
                .setUploadedBytes(item.totalBytes)
                .build()
            )

            updateSessionBytes(sessionId, current.uploadedBytes, byteDelta, builder)
            builder.setCompletedFiles(builder.itemsList.count { it.status == ItemRecord.Status.COMPLETED })
            
            log.i { "Item completed: sessionId=$sessionId, item=$clientItemId, completedFiles=${builder.completedFiles}" }
            builder.build()
        }
    }

    /**
     * Marks an item as failed with an error code.
     */
    suspend fun markItemFailed(sessionId: String, clientItemId: String, errorCode: String) {
        log.w { "Marking item failed: sessionId=$sessionId, item=$clientItemId, errorCode=$errorCode" }
        
        dataStore(sessionId).updateData { current ->
            val builder = current.toBuilder()
            val index = getItemIndex(sessionId, current, clientItemId)
            
            if (index == null) {
                log.w { "Item not found when marking failed: sessionId=$sessionId, item=$clientItemId" }
                return@updateData current
            }

            if (index >= builder.itemsCount) {
                log.e { "Item index out of bounds when marking failed: sessionId=$sessionId, index=$index" }
                return@updateData current
            }

            builder.setItems(index, builder.getItems(index).toBuilder()
                .setStatus(ItemRecord.Status.FAILED)
                .setLastErrorCode(errorCode)
                .build()
            )

            builder.build()
        }
    }

    /**
     * Updates item status (pause/resume).
     */
    suspend fun setItemStatus(
        sessionId: String,
        clientItemId: String,
        status: ItemRecord.Status
    ) {
        dataStore(sessionId).updateData { current ->
            val builder = current.toBuilder()
            val index = getItemIndex(sessionId, current, clientItemId) ?: return@updateData current

            if (index >= builder.itemsCount) return@updateData current

            builder.setItems(index, builder.getItems(index).toBuilder()
                .setStatus(status)
                .build()
            )

            builder.build()
        }
    }

    /**
     * Loads the current session state.
     */
    suspend fun load(sessionId: String): UploadSessionState =
        dataStore(sessionId).data.first()

    /**
     * Records performance metrics for the session.
     */
    suspend fun recordMetrics(
        sessionId: String,
        avgBlockMs: Double? = null,
        p95BlockMs: Double? = null,
        peakBps: Double? = null,
        incRetriesBy: Int = 0
    ) {
        dataStore(sessionId).updateData { current ->
            val metrics = current.metrics.toBuilder()
            avgBlockMs?.let { metrics.avgBlockMs = it }
            p95BlockMs?.let { metrics.p95BlockMs = it }
            peakBps?.let { metrics.peakBps = it }
            metrics.totalRetries = current.metrics.totalRetries + incRetriesBy

            current.toBuilder().setMetrics(metrics).build()
        }
    }

    /**
     * Purges completed sessions older than the specified threshold.
     *
     * @return true if the session was purged, false otherwise
     */
    suspend fun purgeIfCompletedAndOlderThan(sessionId: String, olderThanMs: Long): Boolean {
        val state = load(sessionId)
        val endTime = state.metrics.endedAtMs
        val isCompleted = state.status == SessionStatus.COMPLETED

        if (isCompleted && endTime > 0 && System.currentTimeMillis() - endTime > olderThanMs) {
            appContext.deleteFile("upload_session_${sessionId}.pb")
            closeCoalescer(sessionId)
            sessionsIndex.remove(sessionId)
            return true
        }

        return false
    }

    /**
     * Devuelve una lista de sesiones filtradas por estado usando el índice ligero.
     * Evita leer todos los archivos .pb del disco.
     */
    suspend fun listSessionsByStatus(statuses: Set<SessionStatus>): List<UploadSessionState> {
        val allStatuses = sessionsIndex.getAllStatuses()
        val targetStatusNames = statuses.map { it.name }.toSet()
        
        val matchingIds = allStatuses.filter { (_, statusName) ->
            statusName in targetStatusNames
        }.keys

        return matchingIds.mapNotNull { sessionId ->
            try {
                load(sessionId)
            } catch (e: Exception) {
                log.w { "Failed to load indexed session $sessionId: ${e.message}" }
                null
            }
        }
    }

    // --- Resource Management ---

    /**
     * Closes and cleans up resources for a specific session.
     */
    fun closeCoalescer(sessionId: String) {
        coalescers.remove(sessionId)?.close()
        coalescerLastAccess.remove(sessionId)
        itemIndexCache.remove(sessionId)
        sessionUploadedBytes.remove(sessionId)
    }

    /**
     * Closes all coalescers and cleans up all resources.
     */
    fun closeAll() {
        cleanupJob.cancel()
        coalescers.values.forEach { it.close() }
        coalescers.clear()
        coalescerLastAccess.clear()
        itemIndexCache.clear()
        sessionUploadedBytes.clear()
    }

    // --- Private Helpers ---
    private fun dataStore(sessionId: String): DataStore<UploadSessionState> =
        stores.getOrPut(sessionId) {
            DataStoreSession.get(appContext, sessionId)
        }

    private fun getCoalescer(sessionId: String): WriteCoalescer {
        coalescerLastAccess[sessionId] = System.currentTimeMillis()
        // Synchronize to prevent race with cleanupInactiveCoalescers
        return synchronized(coalescers) {
            coalescers.getOrPut(sessionId) { WriteCoalescer(scope) }
        }
    }

    private fun getItemIndex(
        sessionId: String,
        state: UploadSessionState,
        clientItemId: String
    ): Int? {
        val cache = itemIndexCache.getOrPut(sessionId) { buildItemIndex(state) }
        return cache[clientItemId]
    }

    private fun buildItemIndex(state: UploadSessionState): MutableMap<String, Int> {
        return mutableMapOf<String, Int>().apply {
            for (i in 0 until state.itemsCount) {
                this[state.getItems(i).clientItemId] = i
            }
        }
    }

    private fun updateSessionBytes(
        sessionId: String,
        currentBytes: Long,
        delta: Long,
        builder: UploadSessionState.Builder
    ) {
        val newTotal = sessionUploadedBytes.getOrDefault(sessionId, currentBytes) + delta
        sessionUploadedBytes[sessionId] = newTotal
        builder.setUploadedBytes(newTotal)
    }

    private fun cleanupInactiveCoalescers() {
        val now = System.currentTimeMillis()

        // Snapshot keys to avoid concurrent modification if we were iterating directly
        // though removeIf is safe on ConcurrentHashMap, we need to lock for the check-then-remove atomicity
        // regarding the getCoalescer method.
        val sessionsToCheck = coalescerLastAccess.keys.toList()
        
        sessionsToCheck.forEach { sessionId ->
            val lastAccess = coalescerLastAccess[sessionId] ?: return@forEach
            
            if (now - lastAccess > INACTIVITY_THRESHOLD_MS) {
                synchronized(coalescers) {
                    // Double-check inside lock
                    val currentLastAccess = coalescerLastAccess[sessionId]
                    if (currentLastAccess != null && now - currentLastAccess > INACTIVITY_THRESHOLD_MS) {
                        coalescers.remove(sessionId)?.close()
                        coalescerLastAccess.remove(sessionId)
                        itemIndexCache.remove(sessionId)
                        sessionUploadedBytes.remove(sessionId)
                    }
                }
            }
        }
    }
    
    /**
     * Flush the write coalescer for a session to ensure all pending writes are persisted.
     * Should be called before pausing/stopping a session to guarantee data consistency.
     * 
     * @param sessionId The session ID to flush
     */
    suspend fun flushCoalescer(sessionId: String) {
        log.d { "Flushing write coalescer for session: $sessionId" }
        
        val coalescer = coalescers[sessionId]
        if (coalescer != null) {
            coalescer.flush()
            log.d { "Coalescer flushed for session: $sessionId" }
        } else {
            log.d { "No active coalescer for session: $sessionId" }
        }
    }
}

// --- Data Models ---

data class NewItem(
    val clientItemId: String,
    val localUri: Uri,
    val blobName: String,
    val contentType: String,
    val totalBytes: Long,
    val md5Hex: String? = null,
    val blockMd5Base64: List<String>? = null,
    val metadata: Map<String, String> = emptyMap()
) {
    fun toProto(): ItemRecord = ItemRecord.newBuilder()
        .setClientItemId(clientItemId)
        .setBlobName(blobName)
        .setLocalUri(localUri.toString())
        .setContentType(contentType)
        .setTotalBytes(totalBytes)
        .setUploadedBytes(0)
        .setStatus(ItemRecord.Status.PENDING)
        .apply {
            md5Hex?.let { this.md5Hex = it }
            blockMd5Base64?.forEach { addBlockMd5B64(it) }
            metadataMap.forEach { (k, v) -> putMetadata(k, v) }
        }
        .build()
}

data class SessionOptions(
    val maxParallelFiles: Int,
    val maxParallelChunks: Int,
    val chunkSizeBytes: Int,
    val requiresWiFi: Boolean,
    val allowsCellular: Boolean,
    val lowPowerModeOkay: Boolean
)