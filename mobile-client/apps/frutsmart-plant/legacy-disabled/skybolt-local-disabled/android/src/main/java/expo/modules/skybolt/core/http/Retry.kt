package expo.modules.skybolt.core.http

import expo.modules.skybolt.core.util.logger
import kotlinx.coroutines.delay
import okhttp3.Response
import kotlin.math.min

val log by logger()

suspend inline fun <T> retryHttp(
    maxAttempts: Int = 4,
    baseDelayMs: Long = 250L,
    maxDelayMs: Long = 4000L,
    crossinline label: () -> String = { "backend" },
    crossinline block: suspend (attempt: Int) -> T
): T {
    var attempt = 1
    var lastErr: Throwable? = null
    while (attempt <= maxAttempts) {
        try { 
            return block(attempt)
        } catch (t: Throwable) {
            lastErr = t
            val wait = when (t) {
                is HttpRetryable -> t.retryAfterMs ?: expBackoff(attempt, baseDelayMs, maxDelayMs)
                else -> null
            }
            if (wait == null || attempt == maxAttempts) {
                log.w { "${label()}: Max retries reached or non-retryable error (attempt $attempt/$maxAttempts)" }
                break
            }
            log.i { "${label()}: Retrying in ${wait}ms (attempt $attempt/$maxAttempts): ${t.message}" }
            delay(wait)
            attempt++
        }
    }
    throw lastErr ?: IllegalStateException("retryHttp(${label()}) failed")
}

fun expBackoff(attempt: Int, baseDelayMs: Long = 250L, maxDelayMs: Long = 4000L): Long {
    val f = 1L shl (attempt - 1).coerceAtLeast(0)
    return min(baseDelayMs * f, maxDelayMs)
}

/** Señaliza errores 429/5xx con Retry-After opcional. */
class HttpRetryable(
    message: String,
    val status: Int,
    val retryAfterMs: Long? = null
) : RuntimeException(message)

fun Response.isRetryable(): Boolean = code == 429 || code in 500..599

fun Response.retryAfterMs(): Long? =
    header("Retry-After")?.trim()?.toLongOrNull()?.let { it * 1000L }
