package com.skybolt.core.auth

interface AuthPersistence {
    suspend fun load(): AuthTokens?
    suspend fun save(tokens: AuthTokens?)
}
