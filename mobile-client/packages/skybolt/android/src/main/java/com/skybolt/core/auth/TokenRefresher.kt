package com.skybolt.core.auth

interface TokenRefresher {
    suspend fun refresh(current: AuthTokens): AuthTokens
}
