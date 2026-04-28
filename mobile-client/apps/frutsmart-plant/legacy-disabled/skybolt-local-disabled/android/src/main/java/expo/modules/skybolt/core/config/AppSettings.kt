package expo.modules.skybolt.core.config

import expo.modules.skybolt.core.util.logger
import java.util.concurrent.atomic.AtomicReference

/**
 * Global settings singleton for Skybolt module.
 * Thread-safe storage of configuration accessed throughout the app.
 * 
 * Must be configured via SkyboltManager.configure() before using other APIs.
 */
object AppSettings {
    private val log by logger()
    
    private val configRef = AtomicReference<CloudUploadSettings?>(null)
    
    /**
     * Check if module has been configured.
     */
    val isConfigured: Boolean
        get() = configRef.get() != null
    
    /**
     * Configure global settings.
     * Can be called multiple times to update configuration.
     * 
     * @throws IllegalArgumentException if settings are invalid
     */
    fun configure(settings: CloudUploadSettings) {
        settings.validate()
        configRef.set(settings)
        log.i { "Skybolt configured: env=${settings.environment}, version=${settings.version}" }
    }
    
    /**
     * Get current settings.
     * 
     * @throws IllegalStateException if not configured
     */
    fun getSettings(): CloudUploadSettings {
        return configRef.get() 
            ?: throw IllegalStateException("Skybolt not configured. Call configure() first.")
    }
    
    /**
     * Get backend configuration.
     */
    fun getBackendConfig(): BackendConfig = getSettings().backend
    
    /**
     * Get Azure configuration.
     */
    fun getAzureConfig(): AzureConfig = getSettings().azure
    
    /**
     * Get concurrency configuration.
     */
    fun getConcurrencyConfig(): ConcurrencyConfig = getSettings().concurrency
    
    /**
     * Get retry configuration.
     */
    fun getRetryConfig(): RetryConfig = getSettings().retry
    
    /**
     * Get environment.
     */
    fun getEnvironment(): Environment = getSettings().getEnvironment()
    
    /**
     * Get current version.
     */
    fun getVersion(): String = getSettings().version
    
    /**
     * Clear configuration (mainly for testing).
     */
    internal fun clear() {
        configRef.set(null)
        log.d { "Skybolt configuration cleared" }
    }
    
    /**
     * Get full backend URL for an endpoint.
     */
    fun getEndpointUrl(path: String): String {
        val backend = getBackendConfig()
        val baseUrl = backend.baseUrl.trimEnd('/')
        val cleanPath = path.trimStart('/')
        return "$baseUrl/$cleanPath"
    }
    
    /**
     * Get SAS batch endpoint URL.
     */
    fun getSasBatchUrl(): String {
        return getEndpointUrl(getBackendConfig().endpoints.sasBatchPath)
    }
    
    /**
     * Get SAS refresh endpoint URL.
     */
    fun getSasRefreshUrl(): String {
        return getEndpointUrl(getBackendConfig().endpoints.sasRefreshPath)
    }
}
