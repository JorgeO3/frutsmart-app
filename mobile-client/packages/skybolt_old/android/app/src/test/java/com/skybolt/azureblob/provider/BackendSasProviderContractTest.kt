package com.skybolt.azureblob.provider

import com.skybolt.core.http.BackendApi
import com.skybolt.core.http.NoAuthProvider
import com.skybolt.core.upload.api.ItemSpec
import com.skybolt.core.util.AppLogger
import kotlinx.coroutines.test.runTest
import okhttp3.OkHttpClient
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class BackendSasProviderContractTest {

    private lateinit var server: MockWebServer

    @Before
    fun setUp() {
        AppLogger.disable()
        server = MockWebServer()
        server.start()
    }

    @After
    fun tearDown() {
        server.shutdown()
    }

    @Test
    fun acquire_usesCacheUntilNearExpiry() = runTest {
        server.enqueue(
            MockResponse().setResponseCode(200).setHeader("Content-Type", "application/json").setBody(
                """
                {"sas":[{"blobName":"uploads/a.jpg","url":"https://blob/sas-a","blobUrl":"https://blob/a","expiresOn":"2100-01-01T00:00:00Z"}]}
                """.trimIndent()
            )
        )

        val backend = BackendApi(
            baseUrl = server.url("/api/v1").toString().removeSuffix("/"),
            auth = NoAuthProvider,
            client = OkHttpClient(),
            maxRetries = 1,
            baseDelayMs = 1,
            maxDelayMs = 5,
        )

        val provider = BackendSasProvider(backend, sessionId = "session-cache")
        val item = ItemSpec(
            clientItemId = "item-1",
            localUri = "file:///tmp/a.jpg",
            blobName = "uploads/a.jpg",
            contentType = "image/jpeg",
            sizeBytes = 128,
        )

        val first = provider.acquire(item)
        val second = provider.acquire(item)

        assertEquals("https://blob/sas-a", first)
        assertEquals(first, second)

        val req = server.takeRequest()
        assertTrue(req.path!!.contains("/upload/sessions/session-cache/sas-batch"))
        // Solo una request porque la segunda usa cache
        assertEquals(1, server.requestCount)
    }

    @Test
    fun refresh_callsRefreshEndpointAndReturnsNewSas() = runTest {
        server.enqueue(
            MockResponse().setResponseCode(200).setHeader("Content-Type", "application/json").setBody(
                """
                {"sas":[{"blobName":"uploads/a.jpg","url":"https://blob/sas-old","blobUrl":"https://blob/a","expiresOn":"2100-01-01T00:00:00Z"}]}
                """.trimIndent()
            )
        )
        server.enqueue(
            MockResponse().setResponseCode(200).setHeader("Content-Type", "application/json").setBody(
                """
                {"sas":[{"blobName":"uploads/a.jpg","url":"https://blob/sas-new","blobUrl":"https://blob/a","expiresOn":"2100-01-01T00:00:00Z"}]}
                """.trimIndent()
            )
        )

        val backend = BackendApi(
            baseUrl = server.url("/api/v1").toString().removeSuffix("/"),
            auth = NoAuthProvider,
            client = OkHttpClient(),
            maxRetries = 1,
            baseDelayMs = 1,
            maxDelayMs = 5,
        )

        val provider = BackendSasProvider(backend, sessionId = "session-refresh")
        val item = ItemSpec(
            clientItemId = "item-2",
            localUri = "file:///tmp/a.jpg",
            blobName = "uploads/a.jpg",
            contentType = "image/jpeg",
            sizeBytes = 128,
        )

        provider.acquire(item)
        val refreshed = provider.refresh(item)

        assertEquals("https://blob/sas-new", refreshed)

        val first = server.takeRequest()
        val second = server.takeRequest()
        assertTrue(first.path!!.contains("/upload/sessions/session-refresh/sas-batch"))
        assertTrue(second.path!!.contains("/upload/sessions/session-refresh/sas/refresh"))
    }

    @Test
    fun acquire_failsWhenBackendReturnsInvalidExpiresOn() = runTest {
        server.enqueue(
            MockResponse().setResponseCode(200).setHeader("Content-Type", "application/json").setBody(
                """
                {"sas":[{"blobName":"uploads/a.jpg","url":"https://blob/sas-a","blobUrl":"https://blob/a","expiresOn":"INVALID_DATE"}]}
                """.trimIndent()
            )
        )

        val backend = BackendApi(
            baseUrl = server.url("/api/v1").toString().removeSuffix("/"),
            auth = NoAuthProvider,
            client = OkHttpClient(),
            maxRetries = 1,
            baseDelayMs = 1,
            maxDelayMs = 5,
        )

        val provider = BackendSasProvider(backend, sessionId = "session-invalid-exp")
        val item = ItemSpec(
            clientItemId = "item-3",
            localUri = "file:///tmp/a.jpg",
            blobName = "uploads/a.jpg",
            contentType = "image/jpeg",
            sizeBytes = 128,
        )

        try {
            provider.acquire(item)
            throw AssertionError("Expected error due to invalid expiresOn")
        } catch (e: Exception) {
            val msg = e.message.orEmpty()
            assertTrue(msg.contains("Invalid expiresOn format") || msg.contains("Unparseable date"))
        }
    }
}
