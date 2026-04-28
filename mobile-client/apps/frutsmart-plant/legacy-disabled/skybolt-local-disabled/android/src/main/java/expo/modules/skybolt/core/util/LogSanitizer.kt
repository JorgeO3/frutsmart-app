package expo.modules.skybolt.core.util

import java.util.regex.Pattern

/**
 * Utility for sanitizing sensitive data in log messages.
 * 
 * Removes or masks:
 * - SAS tokens from Azure URLs
 * - Authorization headers
 * - API keys and secrets
 * - Email addresses
 * - Access tokens
 * - Query parameters in URLs (optional)
 * 
 * Usage:
 * ```kotlin
 * val sanitized = LogSanitizer.sanitize(message)
 * log.d { sanitized }
 * ```
 */
object LogSanitizer {
    
    // Regex patterns for sensitive data
    private val SAS_TOKEN_PATTERN = Pattern.compile(
        "(\\?|&)(sig|se|sr|sp|sip|spr|sv|ss|srt|st)=([^&\\s]+)",
        Pattern.CASE_INSENSITIVE
    )
    
    private val AUTH_HEADER_PATTERN = Pattern.compile(
        "(Authorization|Bearer|Token)\\s*[:=]\\s*([^\\s,;]+)",
        Pattern.CASE_INSENSITIVE
    )
    
    private val API_KEY_PATTERN = Pattern.compile(
        "(api[_-]?key|apikey|api[_-]?secret|access[_-]?token)\\s*[:=]\\s*['\"]?([^'\"\\s,;]+)",
        Pattern.CASE_INSENSITIVE
    )
    
    private val EMAIL_PATTERN = Pattern.compile(
        "\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}\\b"
    )
    
    private val AZURE_SAS_URL_PATTERN = Pattern.compile(
        "(https?://[^?\\s]+)(\\?[^\\s]+)"
    )
    
    private const val REDACTED = "[REDACTED]"
    private const val MASKED_EMAIL = "[EMAIL]"
    
    /**
     * Sanitize a log message by removing/masking sensitive information.
     * 
     * @param message Original log message (may be null)
     * @return Sanitized message safe for logging
     */
    fun sanitize(message: String?): String {
        if (message.isNullOrBlank()) return message ?: ""
        
        var sanitized = message
        
        // 1. Remove SAS token parameters from Azure URLs
        sanitized = SAS_TOKEN_PATTERN.matcher(sanitized).replaceAll("$1$2=$REDACTED")
        
        // 2. Remove authorization headers
        sanitized = AUTH_HEADER_PATTERN.matcher(sanitized).replaceAll("$1: $REDACTED")
        
        // 3. Remove API keys and secrets
        sanitized = API_KEY_PATTERN.matcher(sanitized).replaceAll("$1=$REDACTED")
        
        // 4. Mask email addresses
        sanitized = EMAIL_PATTERN.matcher(sanitized).replaceAll(MASKED_EMAIL)
        
        // 5. Handle full Azure SAS URLs (keep base URL, mask query string)
        sanitized = AZURE_SAS_URL_PATTERN.matcher(sanitized).replaceAll("$1?$REDACTED")
        
        return sanitized
    }
    
    /**
     * Sanitize an exception message for logging.
     * Useful when exception messages contain sensitive URLs or tokens.
     */
    fun sanitizeException(e: Throwable?): String {
        if (e == null) return "null"
        
        val message = e.message ?: e::class.java.simpleName
        return sanitize(message)
    }
    
    /**
     * Sanitize a URL for logging.
     * Removes all query parameters, keeping only the base URL.
     * 
     * @param url Original URL (may be null)
     * @param preservePath Whether to keep the path or just show domain
     * @return Sanitized URL
     */
    fun sanitizeUrl(url: String?, preservePath: Boolean = true): String {
        if (url.isNullOrBlank()) return ""
        
        return try {
            val baseUrl = url.substringBefore('?')
            if (preservePath) {
                baseUrl
            } else {
                // Extract just protocol + domain
                val regex = Regex("(https?://[^/]+)")
                regex.find(baseUrl)?.value ?: baseUrl
            }
        } catch (e: Exception) {
            "[INVALID_URL]"
        }
    }
    
    /**
     * Sanitize a map of headers for logging.
     * Masks sensitive header values like Authorization, x-api-key, etc.
     */
    fun sanitizeHeaders(headers: Map<String, String>?): Map<String, String> {
        if (headers == null) return emptyMap()
        
        val sensitiveKeys = setOf(
            "authorization",
            "x-api-key",
            "api-key",
            "x-auth-token",
            "bearer",
            "token",
            "cookie",
            "set-cookie"
        )
        
        return headers.mapValues { (key, value) ->
            if (sensitiveKeys.any { key.equals(it, ignoreCase = true) }) {
                REDACTED
            } else {
                value
            }
        }
    }
    
    /**
     * Partially mask a sensitive string, showing only first/last characters.
     * Useful for IDs or tokens that need partial visibility for debugging.
     * 
     * @param value String to mask
     * @param showChars Number of characters to show at start and end
     * @return Partially masked string
     */
    fun partialMask(value: String?, showChars: Int = 4): String {
        if (value.isNullOrBlank()) return ""
        if (value.length <= showChars * 2) return "*".repeat(value.length)
        
        val start = value.take(showChars)
        val end = value.takeLast(showChars)
        val middle = "*".repeat((value.length - showChars * 2).coerceAtLeast(3))
        
        return "$start$middle$end"
    }
    
    /**
     * Check if a string contains sensitive patterns.
     * Useful for conditional logging.
     */
    fun hasSensitiveData(text: String?): Boolean {
        if (text.isNullOrBlank()) return false
        
        return SAS_TOKEN_PATTERN.matcher(text).find() ||
                AUTH_HEADER_PATTERN.matcher(text).find() ||
                API_KEY_PATTERN.matcher(text).find() ||
                text.contains("sig=", ignoreCase = true) ||
                text.contains("bearer", ignoreCase = true)
    }
}
