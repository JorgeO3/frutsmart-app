@file:Suppress("unused")

package expo.modules.skybolt.core.upload.api


object Err {

    /** Código categorizado y estable para front/back logs. */
    enum class Code {
        // Auth
        AUTH_EXPIRED,            // 401 IdP/backend: reauth
        AUTH_FORBIDDEN,          // 403 roles/política

        // Red
        NET_UNAVAILABLE,         // sin conectividad
        NET_TIMEOUT,             // socket/connect/read timeout
        NET_IO,                  // IOException genérica (TLS, DNS, reset)

        // Backend FrutSmart
        BACKEND_UNAVAILABLE,
        BACKEND_TIMEOUT,
        BACKEND_SERVER_ERROR,    // 5xx
        BACKEND_RATE_LIMITED,    // 429
        BACKEND_UNAUTHORIZED,    // 401
        BACKEND_FORBIDDEN,       // 403
        BACKEND_NOT_FOUND,       // 404
        BACKEND_CONFLICT,        // 409
        BACKEND_BAD_REQUEST,     // 400
        BACKEND_BAD_RESPONSE,    // parse/shape inesperado
        CONTRACT_MISMATCH,       // contrato roto/cambiado

        // Azure Blob
        SAS_EXPIRED,             // 403 desde Blob
        SAS_ACQUIRE_FAILED,      // backend no entregó SAS válida
        AZURE_THROTTLED,         // 429
        AZURE_SERVER_ERROR,      // 5xx
        AZURE_BAD_MD5,           // 400 content-md5 inválido
        AZURE_PUT_BLOCK_FAILED,
        AZURE_PUT_BLOCKLIST_FAILED,

        // Fichero/URI local
        FILE_IO,
        URI_NOT_FOUND,
        PAYLOAD_TOO_LARGE,

        // Flujo/estado
        CANCELED,
        BAD_STATE
    }

    /** Acciones sugeridas para la UI/estrategia (type-safe). */
    enum class Action {
        RETRY,               // reintentar (con o sin backoff)
        REAUTH,              // forzar login
        REFRESH_SAS,         // renovar SAS y reintentar
        PAUSE,               // pausar sesión (hasta condición externa)
        RESUME_ON_NETWORK,   // reanudar automáticamente al volver la red
        CHECK_CONFIG,        // validar settings/versión/contrato
        GIVE_UP              // no reintentar (fallar/abortar)
    }

    /** Pista de recuperación para UI/estrategia. */
    data class Hint(
        val action: Action,
        val delayMs: Long? = null,     // sugerencia de backoff/espera
        val retryable: Boolean? = null // útil para habilitar/deshabilitar botones
    )

    /**
     * Error base con código + metadatos. Usar subclases para cada tipo.
     *
     * Nota: el nombre interno coincide con el objeto para importar como:
     *   expo.modules.skybolt.core.upload.api.UploadError.UploadError
     */
    sealed class UploadError(
        open val code: Code,
        override val message: String,
        open val recoverable: Boolean = false,
        open val hint: Hint? = null,
        open val httpStatus: Int? = null,
        open val retryAfterMs: Long? = null,
        open val attempt: Int? = null,
        cause: Throwable? = null
    ) : Exception(message, cause) {

        // ==== Auth ====
        data class AuthExpired(
            override val message: String = "Authentication required/expired"
        ) : UploadError(
            Code.AUTH_EXPIRED, message,
            recoverable = true,
            hint = Hint(Action.REAUTH)
        )

        data class AuthForbidden(
            override val message: String = "Forbidden by policy/roles"
        ) : UploadError(Code.AUTH_FORBIDDEN, message)

        // ==== Red ====
        data class NetUnavailable(
            override val message: String = "No network available"
        ) : UploadError(
            Code.NET_UNAVAILABLE, message,
            recoverable = true,
            hint = Hint(Action.RESUME_ON_NETWORK, retryable = true)
        )

        data class NetTimeout(
            override val message: String = "Network timeout",
            override val attempt: Int? = null
        ) : UploadError(
            Code.NET_TIMEOUT, message,
            recoverable = true,
            hint = Hint(Action.RETRY, delayMs = 500, retryable = true)
        )

        data class NetIo(
            override val message: String = "Network I/O error",
            val detail: String? = null
        ) : UploadError(
            Code.NET_IO, message,
            recoverable = true,
            hint = Hint(Action.RETRY, delayMs = 800, retryable = true)
        )

        // ==== Backend ====
        data class BackendUnavailable(
            override val message: String = "Backend unavailable"
        ) : UploadError(
            Code.BACKEND_UNAVAILABLE, message,
            recoverable = true,
            hint = Hint(Action.RETRY, delayMs = 1000, retryable = true)
        )

        data class BackendTimeout(
            override val message: String = "Backend timeout",
            override val attempt: Int? = null
        ) : UploadError(
            Code.BACKEND_TIMEOUT, message,
            recoverable = true,
            hint = Hint(Action.RETRY, delayMs = 600, retryable = true)
        )

        data class BackendServerError(
            override val message: String = "Backend 5xx",
            override val httpStatus: Int = 500
        ) : UploadError(
            Code.BACKEND_SERVER_ERROR, message,
            recoverable = true,
            hint = Hint(Action.RETRY, delayMs = 1000, retryable = true),
            httpStatus = httpStatus
        )

        data class BackendRateLimited(
            override val message: String = "Backend 429",
            override val retryAfterMs: Long? = null,
            override val httpStatus: Int = 429
        ) : UploadError(
            Code.BACKEND_RATE_LIMITED, message,
            recoverable = true,
            hint = Hint(Action.RETRY, delayMs = retryAfterMs, retryable = true),
            httpStatus = httpStatus,
            retryAfterMs = retryAfterMs
        )

        data class BackendUnauthorized(
            override val message: String = "Backend 401"
        ) : UploadError(
            Code.BACKEND_UNAUTHORIZED, message,
            recoverable = true,
            hint = Hint(Action.REAUTH)
        )

        data class BackendForbidden(
            override val message: String = "Backend 403"
        ) : UploadError(Code.BACKEND_FORBIDDEN, message)

        data class BackendNotFound(
            override val message: String = "Backend 404"
        ) : UploadError(Code.BACKEND_NOT_FOUND, message)

        data class BackendConflict(
            override val message: String = "Backend 409"
        ) : UploadError(
            Code.BACKEND_CONFLICT, message,
            recoverable = true,
            hint = Hint(Action.RETRY, delayMs = 400, retryable = true)
        )

        data class BackendBadRequest(
            override val message: String = "Backend 400"
        ) : UploadError(Code.BACKEND_BAD_REQUEST, message)

        data class BackendBadResponse(
            override val message: String = "Invalid backend response"
        ) : UploadError(
            Code.BACKEND_BAD_RESPONSE, message,
            recoverable = true,
            hint = Hint(Action.RETRY, delayMs = 0, retryable = true)
        )

        data class ContractMismatch(
            override val message: String = "Backend contract changed"
        ) : UploadError(Code.CONTRACT_MISMATCH, message)

        // ==== Azure Blob ====
        data class SasExpired(
            override val message: String = "SAS expired (403)"
        ) : UploadError(
            Code.SAS_EXPIRED, message,
            recoverable = true,
            hint = Hint(Action.REFRESH_SAS, delayMs = 0, retryable = true)
        )

        data class SasAcquireFailed(
            override val message: String = "SAS acquisition failed"
        ) : UploadError(
            Code.SAS_ACQUIRE_FAILED, message,
            recoverable = true,
            hint = Hint(Action.RETRY, delayMs = 800, retryable = true)
        )

        data class AzureThrottled(
            override val message: String = "Azure throttled (429)",
            override val retryAfterMs: Long? = null
        ) : UploadError(
            Code.AZURE_THROTTLED, message,
            recoverable = true,
            hint = Hint(Action.RETRY, delayMs = retryAfterMs, retryable = true),
            retryAfterMs = retryAfterMs
        )

        data class AzureServerError(
            override val message: String = "Azure 5xx",
            override val httpStatus: Int = 500
        ) : UploadError(
            Code.AZURE_SERVER_ERROR, message,
            recoverable = true,
            hint = Hint(Action.RETRY, delayMs = 1000, retryable = true),
            httpStatus = httpStatus
        )

        data class AzureBadMd5(
            override val message: String = "Invalid Content-MD5"
        ) : UploadError(Code.AZURE_BAD_MD5, message)

        data class AzurePutBlockFailed(
            override val message: String = "PUT Block failed"
        ) : UploadError(
            Code.AZURE_PUT_BLOCK_FAILED, message,
            recoverable = true,
            hint = Hint(Action.RETRY, delayMs = 600, retryable = true)
        )

        data class AzurePutBlockListFailed(
            override val message: String = "PUT BlockList failed"
        ) : UploadError(
            Code.AZURE_PUT_BLOCKLIST_FAILED, message,
            recoverable = true,
            hint = Hint(Action.RETRY, delayMs = 800, retryable = true)
        )

        // ==== Ficheros ====
        data class FileIo(
            override val message: String = "File I/O error"
        ) : UploadError(Code.FILE_IO, message)

        data class UriNotFound(
            override val message: String = "URI not found / not readable"
        ) : UploadError(Code.URI_NOT_FOUND, message)

        data class PayloadTooLarge(
            override val message: String = "Payload too large"
        ) : UploadError(Code.PAYLOAD_TOO_LARGE, message)

        // ==== Flujo ====
        data class Canceled(
            override val message: String = "Canceled"
        ) : UploadError(
            Code.CANCELED, message,
            recoverable = true,
            hint = Hint(Action.GIVE_UP)
        )

        data class BadState(
            override val message: String = "Illegal state"
        ) : UploadError(Code.BAD_STATE, message)
    }

    /** Helper: si falla parseo crítico del backend → CONTRACT_MISMATCH. */
    inline fun <T> parseOrContract(block: () -> T): T =
        try { block() } catch (t: Throwable) {
            throw UploadError.ContractMismatch(
                "Contract mismatch: ${t.message ?: t::class.simpleName}"
            )
        }
}
