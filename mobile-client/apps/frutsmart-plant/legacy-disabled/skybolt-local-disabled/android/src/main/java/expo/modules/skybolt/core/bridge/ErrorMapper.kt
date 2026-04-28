package expo.modules.skybolt.core.bridge

import expo.modules.skybolt.core.upload.api.Err

/**
 * Maps Kotlin UploadError to JavaScript-compatible error format.
 * Provides consistent error codes and messages across the bridge.
 */
object ErrorMapper {
    
    /**
     * Error code constants matching TypeScript expectations.
     */
    object ErrorCodes {
        // Auth errors
        const val AUTH_EXPIRED = "E_AUTH_EXPIRED"
        const val AUTH_FORBIDDEN = "E_AUTH_FORBIDDEN"
        const val AUTH_UNAUTHORIZED = "E_AUTH_UNAUTHORIZED"
        
        // Network errors
        const val NETWORK_UNAVAILABLE = "E_NETWORK_UNAVAILABLE"
        const val NETWORK_TIMEOUT = "E_NETWORK_TIMEOUT"
        const val NETWORK_IO = "E_NETWORK_IO"
        
        // Backend errors
        const val BACKEND_UNAVAILABLE = "E_BACKEND_UNAVAILABLE"
        const val BACKEND_TIMEOUT = "E_BACKEND_TIMEOUT"
        const val BACKEND_SERVER_ERROR = "E_BACKEND_SERVER"
        const val BACKEND_RATE_LIMITED = "E_BACKEND_RATE_LIMITED"
        const val BACKEND_BAD_REQUEST = "E_BACKEND_BAD_REQUEST"
        const val BACKEND_NOT_FOUND = "E_BACKEND_NOT_FOUND"
        const val BACKEND_CONFLICT = "E_BACKEND_CONFLICT"
        const val BACKEND_BAD_RESPONSE = "E_BACKEND_BAD_RESPONSE"
        
        // SAS errors
        const val SAS_EXPIRED = "E_SAS_EXPIRED"
        const val SAS_ACQUIRE_FAILED = "E_SAS_ACQUIRE_FAILED"
        
        // Azure errors
        const val AZURE_THROTTLED = "E_AZURE_THROTTLED"
        const val AZURE_SERVER_ERROR = "E_AZURE_SERVER"
        const val AZURE_BAD_MD5 = "E_AZURE_BAD_MD5"
        const val AZURE_PUT_BLOCK_FAILED = "E_AZURE_PUT_BLOCK_FAILED"
        const val AZURE_PUT_BLOCKLIST_FAILED = "E_AZURE_PUT_BLOCKLIST_FAILED"
        
        // File errors
        const val FILE_IO = "E_FILE_IO"
        const val FILE_NOT_FOUND = "E_FILE_NOT_FOUND"
        const val FILE_TOO_LARGE = "E_FILE_TOO_LARGE"
        
        // State errors
        const val CANCELED = "E_CANCELED"
        const val BAD_STATE = "E_BAD_STATE"
        const val CONTRACT_MISMATCH = "E_CONTRACT_MISMATCH"
        
        // Unknown
        const val UNKNOWN = "E_UNKNOWN"
    }
    
    /**
     * Convert UploadError to JS-compatible error map.
     * Returns map with "code" and "message" keys.
     */
    fun toJsError(error: Err.UploadError): Map<String, String> {
        val (code, message) = when (error) {
            is Err.UploadError.AuthExpired -> 
                ErrorCodes.AUTH_EXPIRED to "Authentication expired: ${error.message}"
            
            is Err.UploadError.AuthForbidden -> 
                ErrorCodes.AUTH_FORBIDDEN to "Access forbidden: ${error.message}"
            
            is Err.UploadError.NetUnavailable -> 
                ErrorCodes.NETWORK_UNAVAILABLE to "Network unavailable: ${error.message}"
            
            is Err.UploadError.NetTimeout -> 
                ErrorCodes.NETWORK_TIMEOUT to "Network timeout (attempt ${error.attempt ?: "?"}): ${error.message}"
            
            is Err.UploadError.NetIo -> 
                ErrorCodes.NETWORK_IO to "Network I/O error: ${error.message}"
            
            is Err.UploadError.BackendUnavailable -> 
                ErrorCodes.BACKEND_UNAVAILABLE to "Backend unavailable: ${error.message}"
            
            is Err.UploadError.BackendTimeout -> 
                ErrorCodes.BACKEND_TIMEOUT to "Backend timeout (attempt ${error.attempt ?: "?"}): ${error.message}"
            
            is Err.UploadError.BackendServerError -> 
                ErrorCodes.BACKEND_SERVER_ERROR to "Backend server error (${error.httpStatus}): ${error.message}"
            
            is Err.UploadError.BackendRateLimited -> 
                ErrorCodes.BACKEND_RATE_LIMITED to "Rate limited, retry after ${(error.retryAfterMs ?: 0) / 1000}s: ${error.message}"
            
            is Err.UploadError.BackendUnauthorized -> 
                ErrorCodes.AUTH_UNAUTHORIZED to "Unauthorized: ${error.message}"
            
            is Err.UploadError.BackendForbidden -> 
                ErrorCodes.AUTH_FORBIDDEN to "Forbidden: ${error.message}"
            
            is Err.UploadError.BackendNotFound -> 
                ErrorCodes.BACKEND_NOT_FOUND to "Resource not found: ${error.message}"
            
            is Err.UploadError.BackendConflict -> 
                ErrorCodes.BACKEND_CONFLICT to "Conflict: ${error.message}"
            
            is Err.UploadError.BackendBadRequest -> 
                ErrorCodes.BACKEND_BAD_REQUEST to "Bad request: ${error.message}"
            
            is Err.UploadError.BackendBadResponse -> 
                ErrorCodes.BACKEND_BAD_RESPONSE to "Bad response: ${error.message}"
            
            is Err.UploadError.ContractMismatch -> 
                ErrorCodes.CONTRACT_MISMATCH to "Contract mismatch: ${error.message}"
            
            is Err.UploadError.SasExpired -> 
                ErrorCodes.SAS_EXPIRED to "SAS token expired: ${error.message}"
            
            is Err.UploadError.SasAcquireFailed -> 
                ErrorCodes.SAS_ACQUIRE_FAILED to "Failed to acquire SAS token: ${error.message}"
            
            is Err.UploadError.AzureThrottled -> 
                ErrorCodes.AZURE_THROTTLED to "Azure throttled, retry after ${(error.retryAfterMs ?: 0) / 1000}s: ${error.message}"
            
            is Err.UploadError.AzureServerError -> 
                ErrorCodes.AZURE_SERVER_ERROR to "Azure server error (${error.httpStatus}): ${error.message}"
            
            is Err.UploadError.AzureBadMd5 -> 
                ErrorCodes.AZURE_BAD_MD5 to "MD5 mismatch: ${error.message}"
            
            is Err.UploadError.AzurePutBlockFailed -> 
                ErrorCodes.AZURE_PUT_BLOCK_FAILED to "Put block failed: ${error.message}"
            
            is Err.UploadError.AzurePutBlockListFailed -> 
                ErrorCodes.AZURE_PUT_BLOCKLIST_FAILED to "Put block list failed: ${error.message}"
            
            is Err.UploadError.FileIo -> 
                ErrorCodes.FILE_IO to "File I/O error: ${error.message}"
            
            is Err.UploadError.UriNotFound -> 
                ErrorCodes.FILE_NOT_FOUND to "File not found: ${error.message}"
            
            is Err.UploadError.PayloadTooLarge -> 
                ErrorCodes.FILE_TOO_LARGE to "File too large: ${error.message}"
            
            is Err.UploadError.Canceled -> 
                ErrorCodes.CANCELED to "Operation canceled: ${error.message}"
            
            is Err.UploadError.BadState -> 
                ErrorCodes.BAD_STATE to "Invalid state: ${error.message}"
        }
        
        return mapOf(
            "code" to code,
            "message" to message
        )
    }
    
    /**
     * Convert generic Throwable to JS-compatible error map.
     */
    fun toJsError(throwable: Throwable): Map<String, String> {
        return when (throwable) {
            is Err.UploadError -> toJsError(throwable)
            is IllegalArgumentException -> mapOf(
                "code" to ErrorCodes.BAD_STATE,
                "message" to (throwable.message ?: "Invalid argument")
            )
            is IllegalStateException -> mapOf(
                "code" to ErrorCodes.BAD_STATE,
                "message" to (throwable.message ?: "Invalid state")
            )
            else -> mapOf(
                "code" to ErrorCodes.UNKNOWN,
                "message" to (throwable.message ?: "Unknown error: ${throwable::class.simpleName}")
            )
        }
    }
    
    /**
     * Create a simple error map with custom code and message.
     */
    fun createError(code: String, message: String): Map<String, String> {
        return mapOf(
            "code" to code,
            "message" to message
        )
    }
}
