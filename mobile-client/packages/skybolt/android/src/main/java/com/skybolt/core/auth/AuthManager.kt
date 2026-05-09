package com.skybolt.core.auth

import com.skybolt.core.util.logger
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

class AuthManager(
    private val persistence: AuthPersistence,
    private val refresher: TokenRefresher?,
    private val onAuthRequired: (() -> Unit)? = null
) {
    private val log by logger()
    private val mutex = Mutex()

    private sealed interface AccessTokenDecision {
        data class Return(val token: String?) : AccessTokenDecision
        data class Refresh(val tokens: AuthTokens, val refresher: TokenRefresher) : AccessTokenDecision
        object AuthRequired : AccessTokenDecision
    }

    suspend fun getValidAccessTokenOrNull(): String? =
        when (val decision = mutex.withLock {
            val tokens = persistence.load() ?: run {
                log.d { "No tokens found in persistence" }
                return@withLock AccessTokenDecision.AuthRequired
            }

            val now = System.currentTimeMillis()

            if (now >= tokens.refreshExpiresAtMs) {
                log.i { "Refresh token expired, clearing auth" }
                persistence.save(null)
                return@withLock AccessTokenDecision.AuthRequired
            }

            if (now < tokens.accessExpiresAtMs) {
                log.v { "Access token valid (expires in ${(tokens.accessExpiresAtMs - now) / 1000}s)" }
                return@withLock AccessTokenDecision.Return(tokens.accessToken)
            }

            val ref = refresher ?: run {
                log.w { "Access token expired but no refresher available" }
                persistence.save(null)
                return@withLock AccessTokenDecision.AuthRequired
            }

            AccessTokenDecision.Refresh(tokens, ref)
        }) {
            is AccessTokenDecision.Return -> decision.token
            AccessTokenDecision.AuthRequired -> {
                onAuthRequired?.invoke()
                null
            }
            is AccessTokenDecision.Refresh -> refreshAccessToken(decision.tokens, decision.refresher)
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

    private suspend fun refreshAccessToken(tokens: AuthTokens, refresher: TokenRefresher): String? {
        return try {
            log.i { "Refreshing access token..." }
            val refreshed = refresher.refresh(tokens)
            validate(refreshed)

            mutex.withLock {
                val latest = persistence.load()
                if (latest != null && latest != tokens) {
                    val now = System.currentTimeMillis()
                    if (now < latest.accessExpiresAtMs) {
                        log.i { "Skipping refreshed token save because tokens changed while refresh was in flight" }
                        return@withLock latest.accessToken
                    }
                }

                persistence.save(refreshed)
                log.i { "Token refresh successful" }
                refreshed.accessToken
            }
        } catch (e: Exception) {
            log.w(e) { "Token refresh failed" }

            val shouldNotifyAuthRequired = mutex.withLock {
                val latest = persistence.load()
                if (latest != null && latest != tokens) {
                    val now = System.currentTimeMillis()
                    if (now < latest.accessExpiresAtMs) {
                        log.i { "Ignoring refresh failure because tokens changed while refresh was in flight" }
                        return@withLock false to latest.accessToken
                    }
                }

                persistence.save(null)
                true to null
            }

            if (shouldNotifyAuthRequired.first) {
                onAuthRequired?.invoke()
            }

            shouldNotifyAuthRequired.second
        }
    }

    private fun validate(tokens: AuthTokens) {
        require(tokens.accessToken.isNotBlank()) { "accessToken cannot be blank" }
        require(tokens.refreshToken.isNotBlank()) { "refreshToken cannot be blank" }
        require(tokens.idToken.isNotBlank()) { "idToken cannot be blank" }
        require(tokens.accessExpiresAtMs > 0L) { "accessExpiresAtMs must be > 0" }
        require(tokens.refreshExpiresAtMs > 0L) { "refreshExpiresAtMs must be > 0" }
    }
}
