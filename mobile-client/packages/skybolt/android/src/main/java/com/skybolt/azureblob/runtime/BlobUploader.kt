package com.skybolt.azureblob.runtime

import android.content.Context
import android.util.Base64
import androidx.core.net.toUri
import com.skybolt.azureblob.crypto.FastMD5
import com.skybolt.azureblob.http.BlobRequests
import com.skybolt.azureblob.provider.SasProvider
import com.skybolt.core.upload.api.Err.UploadError
import com.skybolt.core.upload.api.ItemProgress
import com.skybolt.core.upload.api.ItemSpec
import com.skybolt.core.upload.api.LowLevelUploader
import com.skybolt.core.upload.api.ProgressReporter
import com.skybolt.core.upload.planner.UploadPlan
import com.skybolt.core.util.LogSanitizer
import com.skybolt.core.util.logger
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException
import java.util.concurrent.atomic.AtomicLong
import kotlin.math.min

/**
 * Azure blob uploader with:
 * - SAS refresh on 403
 * - Exponential backoff + Retry-After
 * - Consistent error mapping to Err.*
 * - Granular progress reporting
 */
class BlobUploader(
    private val http: OkHttpClient,
    private val sasProvider: SasProvider,
    private val maxRetries: Int = 4,
    private val apiVersion: String = "2023-11-03",
    private val sendBlockMd5: Boolean = true,
    private val baseDelayMs: Long = 500L,
    private val maxDelayMs: Long = 10_000L,
    private val singlePutMaxBytes: Long = 256L * 1024 * 1024
) : LowLevelUploader {

    private val log by logger()
    
    companion object {
        private const val MEMORY_UPLOAD_THRESHOLD = 2 * 1024 * 1024L // 2MB
    }

    override suspend fun uploadBlockBlob(
        context: Context,
        scope: CoroutineScope,
        sessionId: String,
        item: ItemSpec,
        plan: UploadPlan,
        reporter: ProgressReporter
    ) = log.trace("uploadBlockBlob") {
        withContext(Dispatchers.IO) {
            log.iFields {
                msg = "Starting blob upload"
                "sessionId" to sessionId
                "itemId" to item.clientItemId
                "sizeBytes" to item.sizeBytes
                "blobName" to item.blobName
                "chunkCount" to plan.totalBlocks
            }
            
            if (item.sizeBytes < MEMORY_UPLOAD_THRESHOLD) {
                log.d { "Optimized path: In-memory upload for small file: item=${item.clientItemId}" }
                uploadSmallBlobInMemory(context, item, reporter)
            } else {
                // Siempre resolvemos MD5 final del blob para que backend pueda verificar metadata.
                val blobMd5B64 = item.md5Hex?.let { md5HexToBase64(it) }
                    ?: log.duration(label = "md5Compute") { computeFileMd5(context, item) }

                log.d { "Blob MD5 ready: item=${item.clientItemId}" }

                if (item.sizeBytes <= singlePutMaxBytes) {
                    log.d { "Using single PUT upload: item=${item.clientItemId}" }
                    uploadSingleBlob(context, item, blobMd5B64, reporter)
                } else {
                    log.d { "Using chunked upload: item=${item.clientItemId}, chunks=${plan.totalBlocks}" }
                    uploadByBlocks(context, sessionId, item, plan, blobMd5B64, reporter)
                }
            }
        }
    }

    // --- In-Memory Optimization (<2MB) ---

    private suspend fun uploadSmallBlobInMemory(
        context: Context,
        item: ItemSpec,
        reporter: ProgressReporter
    ) {
        // 1. Read once to RAM
        val bytes = log.duration(label = "readRam") {
            withContext(Dispatchers.IO) {
                context.contentResolver.openInputStream(item.localUri.toUri())?.use { it.readBytes() }
                    ?: throw IOException("Cannot open URI: ${item.localUri}")
            }
        }

        // 2. Compute MD5 in RAM using FastMD5 (ThreadLocal optimized)
        val md5B64 = item.md5Hex?.let { md5HexToBase64(it) } ?: FastMD5.computeMd5Base64(bytes)

        // 3. Upload from RAM
        val body = bytes.toRequestBody(item.contentType.toMediaTypeOrNull())

        retryWithSasRefresh(Operation.PUT_BLOB, item) { sas ->
            BlobRequests.putBlob(
                sasUrl = sas,
                body = body,
                contentType = item.contentType,
                contentMd5B64 = md5B64,
                apiVersion = apiVersion
            )
        }

        reporter.onItemCompleted(item.clientItemId)
    }

    // --- Single PUT (small files) ---

    private suspend fun uploadSingleBlob(
        context: Context,
        item: ItemSpec,
        md5B64: String?,
        reporter: ProgressReporter
    ) {
        val body = UriRequestBody(context, item.localUri.toUri(), item.contentType, item.sizeBytes)

        retryWithSasRefresh(Operation.PUT_BLOB, item) { sas ->
            BlobRequests.putBlob(
                sasUrl = sas,
                body = body,
                contentType = item.contentType,
                contentMd5B64 = if (sendBlockMd5) md5B64 else null,
                apiVersion = apiVersion
            )
        }

        reporter.onItemCompleted(item.clientItemId)
    }

    // --- PUT por bloques (archivos grandes) ---

    private suspend fun uploadByBlocks(
        context: Context,
        sessionId: String,
        item: ItemSpec,
        plan: UploadPlan,
        blobMd5B64: String,
        reporter: ProgressReporter
    ) = log.trace("uploadByBlocks") {
        log.d { "Starting chunked upload: item=${item.clientItemId}, totalBlocks=${plan.totalBlocks}" }
        
        val blockIds = uploadAllBlocks(context, sessionId, item, plan, reporter)
        
        log.d { "All blocks uploaded, committing: item=${item.clientItemId}, blockCount=${blockIds.size}" }
        commitBlockList(item, blockIds, blobMd5B64, reporter)
        
        log.i { "Chunked upload completed: item=${item.clientItemId}" }
    }

    private suspend fun uploadAllBlocks(
        context: Context,
        sessionId: String,
        item: ItemSpec,
        plan: UploadPlan,
        reporter: ProgressReporter
    ): List<String> {
        val blockIds = MutableList<String?>(plan.totalBlocks) { null }
        val uploaded = AtomicLong(0L)
        val chunkParallelism = plan.maxParallelChunks.coerceAtLeast(1)

        reportProgress(reporter, sessionId, item, uploaded.get(), plan.totalBytes, 0)

        coroutineScope {
            val dispatcher = Dispatchers.IO.limitedParallelism(chunkParallelism)
            plan.chunks.map { chunk ->
                async(dispatcher) {
                    require(chunk.size <= Int.MAX_VALUE) {
                        "Chunk demasiado grande (${chunk.size} bytes). Máximo: ${Int.MAX_VALUE}"
                    }

                    val blockId = BlockId.of("$sessionId-${item.clientItemId}", chunk.index)

                    log.iEvery(10, "chunkUpload") {
                        "Uploading chunk: item=${item.clientItemId}, chunk=${chunk.index}/${plan.totalBlocks}, size=${chunk.size}"
                    }

                    val chunkBytes = log.duration(label = "readChunk") {
                        readChunkWithRetry(context, item.localUri, chunk.start, chunk.size.toInt())
                    }

                    val md5B64 = if (sendBlockMd5) {
                        log.duration(label = "chunkMD5") {
                            withContext(Dispatchers.Default) { FastMD5.computeMd5Base64(chunkBytes) }
                        }
                    } else {
                        null
                    }

                    log.duration(label = "putBlock") {
                        uploadSingleBlock(item, blockId, chunkBytes, md5B64)
                    }

                    blockIds[chunk.index] = blockId

                    val currentUploaded = uploaded.addAndGet(chunk.size)
                    reportProgress(
                        reporter,
                        sessionId,
                        item,
                        currentUploaded,
                        plan.totalBytes,
                        chunk.index
                    )
                }
            }.awaitAll()
        }

        val orderedBlockIds = blockIds.mapIndexed { idx, value ->
            requireNotNull(value) { "Missing uploaded block id at index=$idx" }
        }

        log.i {
            "All blocks uploaded successfully: item=${item.clientItemId}, totalBlocks=${orderedBlockIds.size}, parallelChunks=$chunkParallelism"
        }
        return orderedBlockIds
    }

    private suspend fun uploadSingleBlock(
        item: ItemSpec,
        blockId: String,
        chunkBytes: ByteArray,
        md5B64: String?
    ) {
        retryWithSasRefresh(Operation.PUT_BLOCK, item) { sas ->
            BlobRequests.putBlock(
                sasUrl = sas,
                blockIdB64 = blockId,
                bytes = chunkBytes,
                contentMd5B64 = if (sendBlockMd5) md5B64 else null,
                apiVersion = apiVersion
            )
        }
    }

    private suspend fun commitBlockList(
        item: ItemSpec,
        blockIds: List<String>,
        blobMd5B64: String,
        reporter: ProgressReporter
    ) {
        retryWithSasRefresh(Operation.PUT_BLOCKLIST, item) { sas ->
            BlobRequests.putBlockList(
                sasUrl = sas,
                blockIdsB64 = blockIds,
                contentType = item.contentType,
                blobContentMd5B64 = blobMd5B64,
                apiVersion = apiVersion
            )
        }
        reporter.onItemCompleted(item.clientItemId)
    }

    // --- Core retry + SAS refresh ---

    private enum class Operation { PUT_BLOB, PUT_BLOCK, PUT_BLOCKLIST }

    private suspend fun retryWithSasRefresh(
        op: Operation,
        item: ItemSpec,
        requestBuilder: (String) -> Request
    ) {
        val retry = RetryState(sasProvider.acquire(item))
        log.d { "Starting request with retry: op=$op, item=${item.clientItemId}" }

        while (true) {
            when (val result = executeRequest(requestBuilder, retry.currentSas, op)) {
                is RequestResult.Success        -> {
                    log.d { "Request successful: op=$op, item=${item.clientItemId}, attempts=${retry.attempt + 1}" }
                    return
                }
                is RequestResult.SasExpired     -> {
                    log.w { "SAS expired, refreshing: op=$op, item=${item.clientItemId}, attempt=${retry.attempt}" }
                    handleSasExpired(item, retry)
                }
                is RequestResult.TransientError -> {
                    log.w { "Transient error (HTTP ${result.response.code}): op=$op, item=${item.clientItemId}, attempt=${retry.attempt}" }
                    handleTransientError(result.response, retry)
                }
                is RequestResult.NetworkError   -> {
                    log.w(result.exception) { "Network error: op=$op, item=${item.clientItemId}, attempt=${retry.attempt}, error=${LogSanitizer.sanitizeException(result.exception)}" }
                    handleNetworkError(result.exception, retry)
                }
                is RequestResult.FatalError     -> {
                    log.e { "Fatal error: op=$op, item=${item.clientItemId}, error=${result.error}" }
                    throw result.error
                }
            }
        }
    }

    private fun executeRequest(
        requestBuilder: (String) -> Request,
        sas: String,
        op: Operation
    ): RequestResult {
        return try {
            http.newCall(requestBuilder(sas)).execute().use { response ->
                val sanitizedUrl = LogSanitizer.sanitizeUrl(sas)
                log.d { "HTTP response: op=$op, code=${response.code}, url=$sanitizedUrl" }
                when {
                    response.isSuccessful        -> RequestResult.Success
                    response.code == 403         -> RequestResult.SasExpired
                    response.isTransientError()  -> RequestResult.TransientError(response)
                    else                         -> RequestResult.FatalError(mapFatal(op, response))
                }
            }
        } catch (e: IOException) {
            val sanitizedMsg = LogSanitizer.sanitizeException(e)
            log.w { "IO exception during request: op=$op, error=$sanitizedMsg" }
            RequestResult.NetworkError(e)
        }
    }

    private fun mapFatal(op: Operation, resp: Response): UploadError {
        val code = resp.code
        val body = resp.safeBody()
        val azureCode = resp.header("x-ms-error-code")?.trim()

        log.e { "Mapping fatal error: op=$op, code=$code, azureCode=$azureCode, body=${body.take(200)}" }

        if (code == 400 && (azureCode?.contains("Md5", true) == true || body.contains("MD5", true))) {
            return UploadError.AzureBadMd5("400 Md5 mismatch: $azureCode")
        }

        return when (op) {
            Operation.PUT_BLOCK      -> UploadError.AzurePutBlockFailed("HTTP $code: $body")
            Operation.PUT_BLOCKLIST  -> UploadError.AzurePutBlockListFailed("HTTP $code: $body")
            Operation.PUT_BLOB       -> UploadError.AzurePutBlockFailed("HTTP $code: $body")
        }
    }

    private suspend fun handleSasExpired(item: ItemSpec, state: RetryState) {
        state.incrementAttempt()
        if (state.hasExceededMaxRetries(maxRetries)) {
            throw UploadError.SasExpired("SAS expirada tras $maxRetries intentos")
        }
        state.currentSas = sasProvider.refresh(item)
    }

    private suspend fun handleTransientError(response: Response, state: RetryState) {
        state.incrementAttempt()
        if (state.hasExceededMaxRetries(maxRetries)) {
            val code = response.code
            val retryAfterMs = retryAfterMillis(response)
            log.e { "Max retries exceeded for transient error: code=$code, retryAfter=$retryAfterMs" }
            val err: UploadError = when (code) {
                429 -> UploadError.AzureThrottled("429 throttled", retryAfterMs)
                in 500..599 -> UploadError.AzureServerError("Azure 5xx", code)
                408 -> UploadError.NetTimeout("408 timeout", state.attempt)
                else -> UploadError.NetIo("Transient error agotó reintentos", "HTTP $code")
            }
            throw err
        }
        val backoff = calculateBackoff(response, state.attempt)
        log.i { "Transient error (HTTP ${response.code}), retrying in ${backoff}ms (attempt ${state.attempt}/$maxRetries)" }
        delay(backoff)
    }

    private suspend fun handleNetworkError(e: IOException, state: RetryState) {
        state.incrementAttempt()
        if (state.hasExceededMaxRetries(maxRetries)) {
            log.e { "Max retries exceeded for network error: ${e.message}" }
            throw UploadError.NetIo(e.message ?: "IO error", e.toString())
        }
        val backoff = expBackoff(state.attempt)
        log.i { "Network error, retrying in ${backoff}ms (attempt ${state.attempt}/$maxRetries): ${e.message}" }
        delay(backoff)
    }

    // --- State ---

    private class RetryState(var currentSas: String) {
        var attempt: Int = 0
            private set
        fun incrementAttempt() { attempt++ }
        fun hasExceededMaxRetries(max: Int): Boolean = attempt > max
    }

    private sealed class RequestResult {
        object Success : RequestResult()
        object SasExpired : RequestResult()
        data class TransientError(val response: Response) : RequestResult()
        data class NetworkError(val exception: IOException) : RequestResult()
        data class FatalError(val error: UploadError) : RequestResult()
    }

    // --- Helpers ---

    /**
     * Read chunk with transient retry for FILE_IO errors.
     * Retries up to 2 times with delay for transient issues (file descriptor busy, etc).
     */
    private suspend fun readChunkWithRetry(
        context: Context,
        uri: String,
        offset: Long,
        size: Int,
        maxAttempts: Int = 2
    ): ByteArray {
        var attempt = 0

        while (true) {
            try {
                return UriChunkSource.read(context, uri, offset, size)
            } catch (e: IOException) {
                if (attempt >= maxAttempts) {
                    log.e { "FILE_IO failed after $maxAttempts retries: ${LogSanitizer.sanitizeException(e)}" }
                    throw UploadError.FileIo("Failed to read file after $maxAttempts attempts: ${e.message}")
                }

                attempt++
                log.w { "FILE_IO transient error (attempt $attempt/$maxAttempts): ${LogSanitizer.sanitizeException(e)}" }
                delay(200L * attempt)
            } catch (e: Exception) {
                log.e { "Unexpected error reading file: ${LogSanitizer.sanitizeException(e)}" }
                throw UploadError.FileIo("File read error: ${e.message}")
            }
        }
    }

    private suspend fun computeFileMd5(context: Context, item: ItemSpec): String =
        withContext(Dispatchers.IO) {
            FastMD5.computeMd5Base64(context, item.localUri.toUri()).md5Base64
        }

    private fun md5HexToBase64(md5Hex: String): String {
        val normalized = md5Hex.trim().lowercase()
        require(normalized.length == 32) { "Invalid MD5 hex length: ${normalized.length}" }
        require(normalized.all { it in '0'..'9' || it in 'a'..'f' }) {
            "Invalid MD5 hex content"
        }

        val bytes = ByteArray(16)
        for (i in bytes.indices) {
            val idx = i * 2
            bytes[i] = normalized.substring(idx, idx + 2).toInt(16).toByte()
        }
        return Base64.encodeToString(bytes, Base64.NO_WRAP)
    }

    private fun reportProgress(
        reporter: ProgressReporter,
        sessionId: String,
        item: ItemSpec,
        uploaded: Long,
        total: Long,
        blockIndex: Int
    ) {
        reporter.onItemProgress(
            ItemProgress(
                sessionId = sessionId,
                clientItemId = item.clientItemId,
                bytesUploaded = uploaded,
                totalBytes = total,
                blockIndex = blockIndex
            )
        )
    }

    private fun Response.isTransientError(): Boolean =
        code == 408 || code == 429 || code in 500..599

    private fun calculateBackoff(response: Response, attempt: Int): Long =
        min(retryAfterMillis(response) ?: expBackoff(attempt), maxDelayMs)

    private fun expBackoff(attempt: Int): Long {
        val a = attempt.coerceAtLeast(0)
        val factor = 1L shl a
        return min(baseDelayMs * factor, maxDelayMs)
    }

    private fun retryAfterMillis(response: Response): Long? =
        response.header("Retry-After")?.trim()?.toLongOrNull()?.let { it * 1000L }



    private fun Response.safeBody(maxBytes: Int = 8192): String =
        body.let { responseBody ->
            if (responseBody == null) return ""
            val source = responseBody.source()
            source.request((maxBytes + 1).toLong())
            val buffer = source.buffer
            val size = buffer.size
            if (size > maxBytes) buffer.readUtf8(maxBytes.toLong()) + "... [truncado]"
            else buffer.readUtf8()
        }

    /** Generador de blockId Azure (Base64, longitud estable y ordenable). */
    private object BlockId {
        fun of(prefix: String, index: Int): String {
            val p = if (prefix.length > 32) prefix.takeLast(32) else prefix
            val idx = index.toString().padStart(16, '0') // orden lexicográfico
            val raw = ("$p-$idx").toByteArray(Charsets.UTF_8)
            return Base64.encodeToString(raw, Base64.NO_WRAP)
        }
    }
}
