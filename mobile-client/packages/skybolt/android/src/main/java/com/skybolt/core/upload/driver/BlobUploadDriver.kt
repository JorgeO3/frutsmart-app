package com.skybolt.core.upload.driver

import android.content.Context
import com.skybolt.core.bg.Halt
import com.skybolt.core.events.Events
import com.skybolt.core.events.SkyboltEvent
import com.skybolt.core.storage.Mappers
import com.skybolt.core.storage.SessionRepository
import com.skybolt.core.upload.api.Err.Code
import com.skybolt.core.upload.api.Err.UploadError
import com.skybolt.core.upload.api.ItemProgress
import com.skybolt.core.upload.api.LowLevelUploader
import com.skybolt.core.upload.api.ProgressReporter
import com.skybolt.core.upload.planner.UploadPlanner
import com.skybolt.core.util.LogSanitizer
import com.skybolt.core.util.logger
import com.skybolt.proto.ItemRecord
import com.skybolt.proto.UploadSessionState
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.isActive
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit
import kotlin.collections.map
import kotlin.ranges.coerceAtLeast

/**
 * Driver de alto nivel para Azure Block Blob.
 * - Orquesta la subida paralela de archivos.
 * - Maneja la lógica de negocio por item (DB, Eventos, Errores).
 * - Propaga señales de control (Halt) para pausar/reintentar la sesión completa.
 */
class BlobDriver(
    private val context: Context,
    private val lowLevel: LowLevelUploader,
    private val sessionRepository: SessionRepository
) {
    private val log by logger()

    suspend fun uploadSession(
        scope: CoroutineScope,
        session: UploadSessionState,
        progressChannel: Channel<ItemProgress>
    ) = coroutineScope {
        val parallelism = session.maxParallelFiles.coerceAtLeast(1)
        val fileDispatcher = Dispatchers.IO
        val fileSemaphore = Semaphore(parallelism)

        log.i { "Starting session upload: ${session.sessionId}, parallelism=$parallelism" }

        // Filtramos items pendientes
        val pendingItems = session.itemsList.filter { 
            it.status !in setOf(ItemRecord.Status.COMPLETED, ItemRecord.Status.CANCELED)
        }

        // Lanzamos trabajos en paralelo
        // Usamos map + async para lanzar todos, y awaitAll para esperar.
        // Si uno lanza Halt (Auth/Network), coroutineScope cancelará a los demás y propagará la excepción.
        pendingItems.map { itemRecord ->
            async(fileDispatcher) {
                fileSemaphore.withPermit {
                    if (!isActive) throw CancellationException()
                    uploadItemSafe(
                        scope,
                        session.sessionId,
                        itemRecord,
                        session.chunkSizeBytes,
                        session.maxParallelChunks,
                        progressChannel
                    )
                }
            }
        }.awaitAll()
    }

    /**
     * Sube un item capturando errores no fatales para no tumbar toda la sesión.
     * Si ocurre un error fatal (Halt), se relanza para detener la sesión.
     */
    private suspend fun uploadItemSafe(
        scope: CoroutineScope,
        sessionId: String,
        itemRecord: ItemRecord,
        chunkSizeBytes: Int,
        maxParallelChunks: Int,
        progressChannel: Channel<ItemProgress>
    ) {
        try {
            uploadItem(
                scope,
                sessionId,
                itemRecord,
                chunkSizeBytes,
                maxParallelChunks,
                progressChannel
            )
        } catch (h: Halt) {
            // Señal de control: propagar para cancelar hermanos y pausar sesión
            throw h
        } catch (c: CancellationException) {
            throw c
        } catch (e: Exception) {
            // Error de item individual ya manejado internamente (marcado como FAILED en DB).
            // No relanzamos para permitir que otros items continúen.
            // (A menos que la política sea "fail fast", pero aquí asumimos "best effort").
        }
    }

    private suspend fun uploadItem(
        scope: CoroutineScope,
        sessionId: String,
        itemRecord: ItemRecord,
        chunkSizeBytes: Int,
        maxParallelChunks: Int,
        progressChannel: Channel<ItemProgress>
    ) = runCatching {
        log.d { "Starting item upload: ${itemRecord.clientItemId}" }
        val itemSpec = Mappers.itemRecordToItemSpec(itemRecord)
        val plan = UploadPlanner.planFor(itemSpec.sizeBytes, chunkSizeBytes, maxParallelChunks)

        val reporter = object : ProgressReporter {
            override fun onItemProgress(p: ItemProgress) {
                progressChannel.trySend(p)
            }
        }

        lowLevel.uploadBlockBlob(
            context = context,
            scope = scope,
            sessionId = sessionId,
            item = itemSpec,
            plan = plan,
            reporter = reporter
        )

        sessionRepository.markItemCompleted(sessionId, itemSpec.clientItemId)
        log.d { "Item completed: ${itemSpec.clientItemId}" }

        Events.emit(
            SkyboltEvent.ItemCompleted(
                sessionId = sessionId,
                clientItemId = itemSpec.clientItemId
            )
        )
    }.onFailure { t ->
        if (t is CancellationException) throw t
        if (t is Halt) throw t // Propagar Halt inmediatamente

        log.e {
            "Item upload failed: ${itemRecord.clientItemId}, error=${
                LogSanitizer.sanitizeException(t)
            }"
        }

        // Persistimos el fallo del item
        val errorCode = if (t is UploadError) t.javaClass.simpleName else "UnknownError"
        sessionRepository.markItemFailed(sessionId, itemRecord.clientItemId, errorCode)

        if (t is UploadError) {
            // Eventos específicos
            emitSpecificErrorEvent(sessionId, itemRecord.clientItemId, t)
            
            // Verificar si este error debe detener toda la sesión
            mapUploadErrorToHalt(t)?.let { halt ->
                throw halt
            }
        }

        // Evento genérico
        Events.emit(
            SkyboltEvent.ItemFailed(
                sessionId = sessionId,
                clientItemId = itemRecord.clientItemId,
                errorCode = t.javaClass.simpleName,
                errorMessage = t.message ?: "Unknown error"
            )
        )
        
        // Si llegamos aquí, es un error de item aislado (ej. FileIo, 404, BadMd5).
        // Lanzamos excepción para que uploadItemSafe sepa que falló, 
        // aunque uploadItemSafe la atrapará para no cancelar hermanos.
        throw t
    }

    private fun mapUploadErrorToHalt(e: UploadError): Halt? = when (e.code) {
        Code.AUTH_EXPIRED,
        Code.BACKEND_UNAUTHORIZED -> Halt.AuthPause()

        Code.NET_UNAVAILABLE -> Halt.NetworkPause()

        Code.NET_TIMEOUT,
        Code.NET_IO,
        Code.BACKEND_UNAVAILABLE,
        Code.BACKEND_TIMEOUT,
        Code.BACKEND_SERVER_ERROR,
        Code.BACKEND_RATE_LIMITED,
        Code.AZURE_THROTTLED,
        Code.AZURE_SERVER_ERROR,
        Code.SAS_EXPIRED,
        Code.SAS_ACQUIRE_FAILED -> Halt.RetryLater()

        else -> null
    }

    private fun emitSpecificErrorEvent(sessionId: String, itemId: String, error: UploadError) {
        when (error.code) {
            Code.AUTH_FORBIDDEN, Code.BACKEND_FORBIDDEN -> {
                Events.emit(SkyboltEvent.ErrorForbidden(sessionId, itemId, error.message))
            }
            Code.BACKEND_RATE_LIMITED -> {
                Events.emit(SkyboltEvent.ErrorRateLimited(sessionId, itemId, error.message, error.retryAfterMs ?: 0L))
            }
            Code.AZURE_THROTTLED -> {
                Events.emit(SkyboltEvent.ErrorThrottled(sessionId, itemId, error.message, error.retryAfterMs ?: 0L))
            }
            Code.CONTRACT_MISMATCH, Code.BACKEND_NOT_FOUND -> {
                Events.emit(SkyboltEvent.ErrorContract(sessionId, itemId, error.message))
            }
            Code.NET_TIMEOUT, Code.NET_IO, Code.NET_UNAVAILABLE -> {
                Events.emit(SkyboltEvent.ErrorNetwork(sessionId, itemId, error.message, error.attempt ?: 0))
            }
            Code.AZURE_BAD_MD5 -> {
                Events.emit(SkyboltEvent.ErrorChecksum(sessionId, itemId, error.message))
            }
            Code.FILE_IO, Code.URI_NOT_FOUND -> {
                Events.emit(SkyboltEvent.ErrorFileAccess(sessionId, itemId, error.message))
            }
            else -> {}
        }
    }
}
