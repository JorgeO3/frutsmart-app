package expo.modules.skybolt.core.http

import expo.modules.skybolt.BuildConfig
import expo.modules.skybolt.core.upload.api.Err
import expo.modules.skybolt.core.util.logger
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.serializer
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import java.io.IOException
import java.net.SocketTimeoutException

class BackendApi(
    private val baseUrl: String,                       // ej. https://api.frutsmart.com
    private val auth: AuthHeaderProvider,              // inyecta Authorization
    private val client: OkHttpClient,
    private val sasBatchPathTemplate: String = "/upload/sessions/{sessionId}/sas-batch",
    private val sasRefreshPathTemplate: String = "/upload/sessions/{sessionId}/sas/refresh",
    private val maxRetries: Int = 3,
    private val baseDelayMs: Long = 500L,
    private val maxDelayMs: Long = 10_000L,
    private val json: Json = Json { ignoreUnknownKeys = true }
) {
    private val log by logger()

    companion object {
        private val JSON = "application/json; charset=utf-8".toMediaType()
    }

    // -------------------- SAS --------------------

    suspend fun sasBatch(sessionId: String, body: SasBatchRequest): SasBatchResponse =
        post(resolveSessionPath(sasBatchPathTemplate, sessionId, "/upload/sessions/{sessionId}/sas-batch"), body) { respBody ->
            json.decodeFromString<SasBatchResponse>(respBody)
        }

    suspend fun sasRefresh(sessionId: String, body: SasRefreshRequest): SasRefreshResponse =
        post(resolveSessionPath(sasRefreshPathTemplate, sessionId, "/upload/sessions/{sessionId}/sas/refresh"), body) { respBody ->
            json.decodeFromString<SasRefreshResponse>(respBody)
        }

    // -------------------- Core HTTP helpers --------------------

    private suspend inline fun <reified B : Any, T> post(
        path: String,
        body: B,
        noinline parse: (String) -> T
    ): T = retryHttp(
        maxAttempts = maxRetries.coerceAtLeast(1),
        baseDelayMs = baseDelayMs,
        maxDelayMs = maxDelayMs,
        label = { "POST $path" }
    ) {
        val reqBody = json.encodeToString(serializer<B>(), body)
            .toRequestBody(JSON)

        val url = requireHttps(baseUrl.trimEnd('/') + path)
        log.d { "POST $url" }

        val req = Request.Builder()
            .url(url)
            .header("Accept", "application/json")
            .applyAuth(auth)
            .post(reqBody)
            .build()

        execute(req, parse)
    }

    private suspend fun <T> execute(
        request: Request,
        parse: (String) -> T
    ): T = withContext(Dispatchers.IO) {
        try {
            client.newCall(request).execute().use { resp ->
                val bodyStr = resp.body?.string().orEmpty()

                if (resp.isSuccessful) {
                    log.v { "Response ${resp.code} for ${request.url}" }
                    return@use parse(bodyStr)
                }

                log.w { "HTTP Error ${resp.code} for ${request.url}: ${bodyStr.take(200)}" }

                // Señaliza 429/5xx para que retryHttp decida el backoff
                if (resp.isRetryable()) {
                    throw HttpRetryable(
                        message = "HTTP ${resp.code}",
                        status = resp.code,
                        retryAfterMs = resp.retryAfterMs()
                    )
                }

                // Para el resto, mapea a errores de dominio (no-retry)
                throw mapBackendHttpToError(resp, bodyStr)
            }
        } catch (e: SocketTimeoutException) {
            log.w { "SocketTimeout for ${request.url}" }
            // timeouts de socket → reintento
            throw HttpRetryable("Backend timeout", status = 408, retryAfterMs = null)
        } catch (e: IOException) {
            log.w { "IOException for ${request.url}: ${e.message}" }
            // fallas IO/TLS/DNS → reintento con backoff
            throw HttpRetryable("Backend unavailable: ${e.message ?: "IO error"}", status = 0, retryAfterMs = null)
        }
    }

    private fun Request.Builder.applyAuth(a: AuthHeaderProvider): Request.Builder {
        a.authorization()?.let { header("Authorization", it) }
        a.extraHeaders().forEach { (k, v) -> header(k, v) }
        return this
    }

    private fun requireHttps(url: String): String {
        // Si estás en un módulo library, usa el BuildConfig de ese módulo:
        val allowHttp = BuildConfig.ALLOW_HTTP_IN_DEV
        // val allowHttp = BuildConfig.ALLOW_HTTP_IN_DEV

        val isHttps = url.startsWith("https://", ignoreCase = true)
        val isHttp  = url.startsWith("http://",  ignoreCase = true)

        if (allowHttp && isHttp) return url
        require(isHttps) { "Solo HTTPS permitido en esta build: $url" }
        return url
    }

    private fun mapBackendHttpToError(resp: Response, bodySnippet: String): Err.UploadError {
        val code = resp.code
        val preview = bodySnippet.take(512)
        return when (code) {
            401 -> Err.UploadError.BackendUnauthorized("Backend 401")
            403 -> Err.UploadError.BackendForbidden("Backend 403")
            404 -> Err.UploadError.BackendNotFound("Backend 404")
            409 -> Err.UploadError.BackendConflict("Backend 409")
            408 -> Err.UploadError.BackendTimeout("Backend 408")
            400 -> Err.UploadError.BackendBadRequest("Backend 400: $preview")
            in 500..599 -> Err.UploadError.BackendServerError("Backend $code", httpStatus = code)
            429 -> {
                val retryAfterSec = resp.header("Retry-After")?.toLongOrNull()
                Err.UploadError.BackendRateLimited("Backend 429", retryAfterMs = retryAfterSec?.times(1000))
            }
            else -> Err.UploadError.BackendBadResponse("HTTP $code: $preview")
        }
    }

    private fun resolveSessionPath(template: String, sessionId: String, fallbackTemplate: String): String {
        val source = template.ifBlank { fallbackTemplate }
        val resolved = source
            .replace("{sessionId}", sessionId)
            .replace(":sessionId", sessionId)
        return if (resolved.startsWith('/')) resolved else "/$resolved"
    }
}
