package expo.modules.skybolt.core.auth

interface TokenRefresher {
    suspend fun refresh(current: AuthTokens): AuthTokens
}
