package com.skybolt.azureblob.provider

import com.skybolt.core.http.BackendApi
import com.skybolt.core.http.SasBatchRequest
import com.skybolt.core.http.SasItem
import com.skybolt.core.http.SasRefreshRequest
import com.skybolt.core.upload.api.Err.UploadError
import com.skybolt.core.upload.api.ItemSpec
import com.skybolt.core.util.logger
import java.util.concurrent.ConcurrentHashMap
import java.time.Instant
import java.time.format.DateTimeParseException
import java.text.SimpleDateFormat
import java.util.Locale


/**
 * Proveedor SAS acoplado al backend, con caché TTL por blob.
 */
class BackendSasProvider(
    private val backend: BackendApi,
    private val sessionId: String
) : SasProvider {

    private val log by logger()

    private data class CachedSas(val url: String, val expiresAt: Long)
    private val cache = ConcurrentHashMap<String, CachedSas>()
    private val safetyMarginMs = 5 * 60 * 1000L

    override suspend fun acquire(item: ItemSpec): String {
        // cache hit con margen
        cache[item.blobName]?.let { c ->
            if (c.expiresAt - System.currentTimeMillis() > safetyMarginMs) {
                log.d { "Using cached SAS for ${item.blobName} (expires in ${(c.expiresAt - System.currentTimeMillis()) / 1000}s)" }
                return c.url
            } else {
                log.d { "Cached SAS for ${item.blobName} expired or near expiry" }
            }
        }
        return requestBatchAndPick(item)
    }

    override suspend fun refresh(item: ItemSpec): String {
        log.i { "Refreshing SAS for ${item.blobName}" }
        cache.remove(item.blobName)

        val resp = backend.sasRefresh(
            sessionId = sessionId,
            body = SasRefreshRequest(
                blobNames = listOf(item.blobName)
            )
        )
        val sas = resp.sas.firstOrNull { it.blobName == item.blobName }
            ?: run {
                log.e { "Backend did not return refreshed SAS for ${item.blobName}" }
                throw UploadError.SasAcquireFailed("Backend did not return refreshed SAS for ${item.blobName}")
            }

        cache[item.blobName] = CachedSas(sas.url, sas.expiresOn.let {
            try {
              Instant.parse(it).toEpochMilli()
            } catch (_: DateTimeParseException) {
              // fallback si el formato no es exactamente ISO_INSTANT
              val fmt = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ssX", Locale.US)
              fmt.parse(it)?.time
                ?: throw UploadError.SasAcquireFailed("Invalid expiresOn format: $it")
            }
        })
        log.d { "SAS refreshed for ${item.blobName}" }
        return sas.url
    }

    fun clearAll() {
        log.d { "Clearing all cached SAS tokens" }
        cache.clear()
    }
    fun clear(blobName: String) { cache.remove(blobName) }

    private suspend fun requestBatchAndPick(item: ItemSpec): String {
        log.d { "Requesting SAS batch for ${item.blobName}" }
        val resp = backend.sasBatch(
            sessionId = sessionId,
            body = SasBatchRequest(
                items = listOf(
                    SasItem(
                        blobName = item.blobName,
                        contentType = item.contentType
                    )
                )
            )
        )
        val sas = resp.sas.firstOrNull { it.blobName == item.blobName }
            ?: run {
                log.e { "Backend did not return SAS for ${item.blobName}" }
                throw UploadError.SasAcquireFailed("Backend did not return SAS for ${item.blobName}")
            }

        cache[item.blobName] = CachedSas(sas.url, sas.expiresOn.let {
            try {
              Instant.parse(it).toEpochMilli()
            } catch (_: DateTimeParseException) {
              // fallback si el formato no es exactamente ISO_INSTANT
              val fmt = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ssX", Locale.US)
              fmt.parse(it)?.time
                ?: throw UploadError.SasAcquireFailed("Invalid expiresOn format: $it")
            }
        })
        log.d { "SAS acquired for ${item.blobName}" }
        return sas.url
    }
}