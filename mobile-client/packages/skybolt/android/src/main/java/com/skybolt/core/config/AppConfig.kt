package com.skybolt.core.config

import kotlinx.serialization.Serializable

/**
 * Environment configuration matching TypeScript Environment type.
 */
enum class Environment {
    DEV,
    STAGE,
    PROD;

    companion object {
        fun fromString(value: String): Environment = when (value.lowercase()) {
            "dev" -> DEV
            "stage" -> STAGE
            "prod" -> PROD
            else -> throw IllegalArgumentException("Invalid environment: $value. Must be 'dev', 'stage', or 'prod'")
        }
    }
}

/**
 * Backend API endpoint configuration.
 * Matches TypeScript BackendConfig type.
 */
@Serializable
data class BackendConfig(
    val baseUrl: String,
    val defaultHeaders: Map<String, String> = emptyMap(),
    val endpoints: EndpointPaths,
    val auth: AuthConfig
) {
    init {
        require(baseUrl.isNotBlank()) { "Backend baseUrl cannot be blank" }
        require(baseUrl.startsWith("http://") || baseUrl.startsWith("https://")) {
            "Backend baseUrl must start with http:// or https://"
        }
    }
}

/**
 * Authorization configuration for backend API.
 * Matches TypeScript AuthConfig type.
 */@Serializable
data class AuthConfig(
    val tokenEndpoint: String,
    val clientId: String,
    val scope: String,
    val clockSkewMs: Long = 30_000L
) {
    init {
        require(tokenEndpoint.isNotBlank()) { "Auth tokenEndpoint cannot be blank" }
        require(clientId.isNotBlank()) { "Auth clientId cannot be blank" }
        require(scope.isNotBlank()) { "Auth scope cannot be blank" }
        require(clockSkewMs >= 0) { "Auth clockSkewMs cannot be negative" }
    }
}


/**
 * API endpoint paths.
 */
@Serializable
data class EndpointPaths(
    val sasBatchPath: String,
    val sasRefreshPath: String
) {
    init {
        require(sasBatchPath.isNotBlank()) { "sasBatchPath cannot be blank" }
        require(sasRefreshPath.isNotBlank()) { "sasRefreshPath cannot be blank" }
    }
}

/**
 * Azure Blob Storage configuration.
 * Matches TypeScript AzureConfig type.
 */
@Serializable
data class AzureConfig(
    val serviceVersion: String = "2023-11-03",
    val sendBlockMd5: Boolean = true,
    val defaultChunkBytes: Int = 4 * 1024 * 1024 // 4MB
) {
    companion object {
        private const val MIN_CHUNK_SIZE = 64 * 1024 // 64KB minimum
        private const val MAX_CHUNK_SIZE = 100 * 1024 * 1024 // 100MB maximum
    }

    init {
        require(serviceVersion.isNotBlank()) { "Azure serviceVersion cannot be blank" }
        require(defaultChunkBytes >= MIN_CHUNK_SIZE) {
            "defaultChunkBytes must be at least $MIN_CHUNK_SIZE bytes (64KB)"
        }
        require(defaultChunkBytes <= MAX_CHUNK_SIZE) {
            "defaultChunkBytes must not exceed $MAX_CHUNK_SIZE bytes (100MB)"
        }
    }
}

/**
 * Concurrency control configuration.
 * Matches TypeScript ConcurrencyConfig type.
 */
@Serializable
data class ConcurrencyConfig(
    val maxParallelFiles: Int = 2,
    val maxParallelChunks: Int = 4
) {
    init {
        require(maxParallelFiles in 1..10) { "maxParallelFiles must be between 1 and 10" }
        require(maxParallelChunks in 1..20) { "maxParallelChunks must be between 1 and 20" }
    }
}

/**
 * Retry strategy configuration with exponential backoff.
 * Matches TypeScript RetryConfig type.
 */
@Serializable
data class RetryConfig(
    val maxRetries: Int = 3,
    val baseDelayMs: Long = 500L,
    val maxDelayMs: Long = 10_000L
) {
    init {
        require(maxRetries in 0..10) { "maxRetries must be between 0 and 10" }
        require(baseDelayMs > 0) { "baseDelayMs must be positive" }
        require(maxDelayMs >= baseDelayMs) { "maxDelayMs must be >= baseDelayMs" }
    }
}

/**
 * Complete cloud upload configuration.
 * Matches TypeScript CloudUploadSettings type exactly.
 */
@Serializable
data class CloudUploadSettings(
    val version: String,
    val environment: String, // Will be converted to Environment enum
    val backend: BackendConfig,
    val azure: AzureConfig = AzureConfig(),
    val concurrency: ConcurrencyConfig = ConcurrencyConfig(),
    val retry: RetryConfig = RetryConfig()
) {
    companion object {
        /**
         * Create settings from a map (coming from JS).
         */
        fun fromMap(map: Map<String, Any?>): CloudUploadSettings {
            val version = map["version"] as? String
                ?: throw IllegalArgumentException("Missing required field: version")

            val environment = map["environment"] as? String
                ?: throw IllegalArgumentException("Missing required field: environment")

            val backendMap = map["backend"] as? Map<*, *>
                ?: throw IllegalArgumentException("Missing required field: backend")

            val azureMap = map["azure"] as? Map<*, *>
            val concurrencyMap = map["concurrency"] as? Map<*, *>
            val retryMap = map["retry"] as? Map<*, *>

            return CloudUploadSettings(
                version = version,
                environment = environment,
                backend = parseBackendConfig(backendMap),
                azure = azureMap?.let { parseAzureConfig(it) } ?: AzureConfig(),
                concurrency = concurrencyMap?.let { parseConcurrencyConfig(it) } ?: ConcurrencyConfig(),
                retry = retryMap?.let { parseRetryConfig(it) } ?: RetryConfig()
            )
        }

        private fun parseBackendConfig(map: Map<*, *>): BackendConfig {
            val baseUrl = map["baseUrl"] as? String
                ?: throw IllegalArgumentException("backend.baseUrl is required")

            val defaultHeaders = (map["defaultHeaders"] as? Map<*, *>)
                ?.mapKeys { it.key.toString() }
                ?.mapValues { it.value.toString() }
                ?: emptyMap()

            val endpointsMap = map["endpoints"] as? Map<*, *>
                ?: throw IllegalArgumentException("backend.endpoints is required")

            val sasBatchPath = endpointsMap["sasBatchPath"] as? String
                ?: throw IllegalArgumentException("backend.endpoints.sasBatchPath is required")

            val sasRefreshPath = endpointsMap["sasRefreshPath"] as? String
                ?: throw IllegalArgumentException("backend.endpoints.sasRefreshPath is required")

            val authMap = map["auth"] as? Map<*, *>
                ?: throw IllegalArgumentException("backend.auth is required")

            return BackendConfig(
                baseUrl = baseUrl,
                defaultHeaders = defaultHeaders,
                endpoints = EndpointPaths(sasBatchPath, sasRefreshPath),
                auth = parseAuthConfig(authMap)
            )
        }

        private fun parseAzureConfig(map: Map<*, *>): AzureConfig {
            return AzureConfig(
                serviceVersion = (map["serviceVersion"] as? String) ?: "2023-11-03",
                sendBlockMd5 = (map["sendBlockMd5"] as? Boolean) ?: true,
                defaultChunkBytes = ((map["defaultChunkBytes"] as? Number)?.toInt()) ?: (4 * 1024 * 1024)
            )
        }

        private fun parseConcurrencyConfig(map: Map<*, *>): ConcurrencyConfig {
            return ConcurrencyConfig(
                maxParallelFiles = ((map["maxParallelFiles"] as? Number)?.toInt()) ?: 2,
                maxParallelChunks = ((map["maxParallelChunks"] as? Number)?.toInt()) ?: 4
            )
        }

        private fun parseRetryConfig(map: Map<*, *>): RetryConfig {
            return RetryConfig(
                maxRetries = ((map["maxRetries"] as? Number)?.toInt()) ?: 3,
                baseDelayMs = ((map["baseDelayMs"] as? Number)?.toLong()) ?: 500L,
                maxDelayMs = ((map["maxDelayMs"] as? Number)?.toLong()) ?: 10_000L
            )
        }

        private fun parseAuthConfig(map: Map<*, *>): AuthConfig {
            val tokenEndpoint = map["tokenEndpoint"] as? String
                ?: throw IllegalArgumentException("backend.auth.tokenEndpoint is required")

            val clientId = map["clientId"] as? String
                ?: throw IllegalArgumentException("backend.auth.clientId is required")

            val scope = map["scope"] as? String
                ?: throw IllegalArgumentException("backend.auth.scope is required")

            val clockSkewMs = ((map["clockSkewMs"] as? Number)?.toLong()) ?: 30_000L

            return AuthConfig(
                tokenEndpoint = tokenEndpoint,
                clientId = clientId,
                scope = scope,
                clockSkewMs = clockSkewMs,
            )
        }
    }

    /**
     * Get environment as enum.
     */
    fun getEnvironment(): Environment = Environment.fromString(environment)

    /**
     * Validate all configuration values.
     */
    fun validate() {
        // Validation happens in init blocks of data classes
        getEnvironment() // Validate environment string
    }
}
