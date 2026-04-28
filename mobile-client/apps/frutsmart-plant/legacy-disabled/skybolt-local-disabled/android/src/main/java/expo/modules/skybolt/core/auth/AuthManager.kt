package expo.modules.skybolt.core.auth

import expo.modules.skybolt.core.util.logger
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

class AuthManager(
    private val persistence: AuthPersistence,
    private val refresher: TokenRefresher?,
    private val onAuthRequired: (() -> Unit)? = null
) {
    private val log by logger()
    private val mutex = Mutex()

    suspend fun getValidAccessTokenOrNull(): String? =
        mutex.withLock {
            val tokens = persistence.load() ?: run {
                log.d { "No tokens found in persistence" }
                onAuthRequired?.invoke()
                return null
            }

            val now = System.currentTimeMillis()

            if (now >= tokens.refreshExpiresAtMs) {
                log.i { "Refresh token expired, clearing auth" }
                persistence.save(null)
                onAuthRequired?.invoke()
                return null
            }

            if (now < tokens.accessExpiresAtMs) {
                log.v { "Access token valid (expires in ${(tokens.accessExpiresAtMs - now) / 1000}s)" }
                return tokens.accessToken
            }

            val ref = refresher ?: run {
                log.w { "Access token expired but no refresher available" }
                persistence.save(null)
                onAuthRequired?.invoke()
                return null
            }

            return try {
                log.i { "Refreshing access token..." }
                val refreshed = ref.refresh(tokens)
                validate(refreshed)
                persistence.save(refreshed)
                log.i { "Token refresh successful" }
                refreshed.accessToken
            } catch (e: Exception) {
                log.w(e) { "Token refresh failed" }
                persistence.save(null)
                onAuthRequired?.invoke()
                null
            }
        }

    suspend fun updateTokens(tokens: AuthTokens?) {
        mutex.withLock {
            if (tokens != null) {
                validate(tokens)
                log.i { "Updating tokens (access expires in ${(tokens.accessExpiresAtMs - System.currentTimeMillis()) / 1000}s)" }
            } else {
                log.i { "Clearing tokens" }
            }
            persistence.save(tokens)
        }
    }

    suspend fun clear() {
        updateTokens(null)
    }

    private fun validate(tokens: AuthTokens) {
        require(tokens.accessToken.isNotBlank()) { "accessToken cannot be blank" }
        require(tokens.refreshToken.isNotBlank()) { "refreshToken cannot be blank" }
        require(tokens.idToken.isNotBlank()) { "idToken cannot be blank" }
        require(tokens.accessExpiresAtMs > 0L) { "accessExpiresAtMs must be > 0" }
        require(tokens.refreshExpiresAtMs > 0L) { "refreshExpiresAtMs must be > 0" }
    }
}
