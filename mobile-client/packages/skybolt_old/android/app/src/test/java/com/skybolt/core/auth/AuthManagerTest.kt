package com.skybolt.core.auth

import com.skybolt.core.util.AppLogger
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.util.concurrent.atomic.AtomicInteger

class AuthManagerTest {

    @Before
    fun disableAndroidLogSinkForJvmTests() {
        AppLogger.disable()
    }

    @Test
    fun returnsAccessTokenWhenStillValid() = runTest {
        val now = System.currentTimeMillis()
        val persistence = InMemoryAuthPersistence(
            AuthTokens(
                accessToken = "access-valid",
                refreshToken = "refresh-valid",
                idToken = "id-valid",
                accessExpiresAtMs = now + 60_000,
                refreshExpiresAtMs = now + 120_000,
            )
        )

        val manager = AuthManager(
            persistence = persistence,
            refresher = null,
            onAuthRequired = null,
        )

        val token = manager.getValidAccessTokenOrNull()
        assertEquals("access-valid", token)
    }

    @Test
    fun refreshesTokenWhenAccessExpired() = runTest {
        val now = System.currentTimeMillis()
        val persistence = InMemoryAuthPersistence(
            AuthTokens(
                accessToken = "access-expired",
                refreshToken = "refresh-valid",
                idToken = "id-valid",
                accessExpiresAtMs = now - 1_000,
                refreshExpiresAtMs = now + 120_000,
            )
        )

        val refreshed = AuthTokens(
            accessToken = "access-refreshed",
            refreshToken = "refresh-refreshed",
            idToken = "id-refreshed",
            accessExpiresAtMs = now + 60_000,
            refreshExpiresAtMs = now + 120_000,
        )

        val manager = AuthManager(
            persistence = persistence,
            refresher = object : TokenRefresher {
                override suspend fun refresh(current: AuthTokens): AuthTokens = refreshed
            },
            onAuthRequired = null,
        )

        val token = manager.getValidAccessTokenOrNull()
        assertEquals("access-refreshed", token)
        assertEquals("access-refreshed", persistence.load()?.accessToken)
    }

    @Test
    fun clearsAndRequiresAuthWhenRefreshExpired() = runTest {
        val now = System.currentTimeMillis()
        val persistence = InMemoryAuthPersistence(
            AuthTokens(
                accessToken = "access-expired",
                refreshToken = "refresh-expired",
                idToken = "id-valid",
                accessExpiresAtMs = now - 60_000,
                refreshExpiresAtMs = now - 1_000,
            )
        )

        val authRequiredCount = AtomicInteger(0)
        val manager = AuthManager(
            persistence = persistence,
            refresher = null,
            onAuthRequired = { authRequiredCount.incrementAndGet() },
        )

        val token = manager.getValidAccessTokenOrNull()
        assertNull(token)
        assertEquals(1, authRequiredCount.get())
        assertNull(persistence.load())
    }

    @Test
    fun handlesConcurrentRefreshWithSingleRefresherCall() = runTest {
        val now = System.currentTimeMillis()
        val persistence = InMemoryAuthPersistence(
            AuthTokens(
                accessToken = "access-expired",
                refreshToken = "refresh-valid",
                idToken = "id-valid",
                accessExpiresAtMs = now - 1_000,
                refreshExpiresAtMs = now + 120_000,
            )
        )

        val refreshCalls = AtomicInteger(0)
        val manager = AuthManager(
            persistence = persistence,
            refresher = object : TokenRefresher {
                override suspend fun refresh(current: AuthTokens): AuthTokens {
                    refreshCalls.incrementAndGet()
                    val n = System.currentTimeMillis()
                    return AuthTokens(
                        accessToken = "access-refreshed",
                        refreshToken = "refresh-refreshed",
                        idToken = "id-refreshed",
                        accessExpiresAtMs = n + 60_000,
                        refreshExpiresAtMs = n + 120_000,
                    )
                }
            },
            onAuthRequired = null,
        )

        val tokens = (1..10).map {
            async { manager.getValidAccessTokenOrNull() }
        }.awaitAll()

        assertEquals(1, refreshCalls.get())
        assertTrue(tokens.all { it == "access-refreshed" })
    }
}

private class InMemoryAuthPersistence(
    private var tokens: AuthTokens?,
) : AuthPersistence {
    override suspend fun load(): AuthTokens? = tokens
    override suspend fun save(tokens: AuthTokens?) {
        this.tokens = tokens
    }
}
