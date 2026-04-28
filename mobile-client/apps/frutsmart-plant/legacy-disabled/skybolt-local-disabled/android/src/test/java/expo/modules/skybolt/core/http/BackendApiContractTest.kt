package expo.modules.skybolt.core.http

import expo.modules.skybolt.core.upload.api.Err
import expo.modules.skybolt.core.util.AppLogger
import kotlinx.coroutines.test.runTest
import okhttp3.OkHttpClient
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class BackendApiContractTest {

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
    fun sasBatch_usesConfiguredTemplateAndHeaders() = runTest {
        server.enqueue(
            MockResponse()
                .setResponseCode(200)
                .setHeader("Content-Type", "application/json")
                .setBody(
                    """
                    {"sas":[{"blobName":"uploads/a.jpg","url":"https://blob/sas-a","blobUrl":"https://blob/a","expiresOn":"2026-01-01T00:00:00Z"}]}
                    """.trimIndent()
                )
        )

        val backend = BackendApi(
            baseUrl = server.url("/api/v1").toString().removeSuffix("/"),
            auth = CompositeAuthProvider(
                object : AuthHeaderProvider {
                    override fun authorization(): String = "Bearer test-token"
                },
                StaticHeadersProvider(mapOf("x-internal-secret" to "abc123"))
            ),
            client = OkHttpClient(),
            sasBatchPathTemplate = "/upload/sessions/{sessionId}/sas-batch",
            sasRefreshPathTemplate = "/upload/sessions/{sessionId}/sas/refresh",
            maxRetries = 1,
            baseDelayMs = 1,
            maxDelayMs = 5,
        )

        val resp = backend.sasBatch(
            sessionId = "sess-1",
            body = SasBatchRequest(
                items = listOf(SasItem(blobName = "uploads/a.jpg", contentType = "image/jpeg"))
            )
        )

        val req = server.takeRequest()
        assertEquals("/api/v1/upload/sessions/sess-1/sas-batch", req.path)
        assertEquals("Bearer test-token", req.getHeader("Authorization"))
        assertEquals("abc123", req.getHeader("x-internal-secret"))
        assertTrue(req.body.readUtf8().contains("uploads/a.jpg"))
        assertEquals(1, resp.sas.size)
    }

    @Test
    fun sasRefresh_supportsColonSessionIdTemplate() = runTest {
        server.enqueue(
            MockResponse()
                .setResponseCode(200)
                .setHeader("Content-Type", "application/json")
                .setBody(
                    """
                    {"sas":[{"blobName":"uploads/a.jpg","url":"https://blob/sas-a","blobUrl":"https://blob/a","expiresOn":"2026-01-01T00:00:00Z"}]}
                    """.trimIndent()
                )
        )

        val backend = BackendApi(
            baseUrl = server.url("/api/v1").toString().removeSuffix("/"),
            auth = NoAuthProvider,
            client = OkHttpClient(),
            sasBatchPathTemplate = "/upload/sessions/:sessionId/sas-batch",
            sasRefreshPathTemplate = "/upload/sessions/:sessionId/sas/refresh",
            maxRetries = 1,
            baseDelayMs = 1,
            maxDelayMs = 5,
        )

        backend.sasRefresh(
            sessionId = "sess-2",
            body = SasRefreshRequest(blobNames = listOf("uploads/a.jpg"))
        )

        val req = server.takeRequest()
        assertEquals("/api/v1/upload/sessions/sess-2/sas/refresh", req.path)
    }

    @Test
    fun sasBatch_retriesOn5xxAndSucceeds() = runTest {
        server.enqueue(MockResponse().setResponseCode(500).setBody("boom"))
        server.enqueue(
            MockResponse()
                .setResponseCode(200)
                .setHeader("Content-Type", "application/json")
                .setBody(
                    """
                    {"sas":[{"blobName":"uploads/a.jpg","url":"https://blob/sas-a","blobUrl":"https://blob/a","expiresOn":"2026-01-01T00:00:00Z"}]}
                    """.trimIndent()
                )
        )

        val backend = BackendApi(
            baseUrl = server.url("/api/v1").toString().removeSuffix("/"),
            auth = NoAuthProvider,
            client = OkHttpClient(),
            maxRetries = 2,
            baseDelayMs = 1,
            maxDelayMs = 5,
        )

        val resp = backend.sasBatch(
            sessionId = "sess-3",
            body = SasBatchRequest(items = listOf(SasItem("uploads/a.jpg", "image/jpeg")))
        )

        assertEquals(1, resp.sas.size)
        val first = server.takeRequest()
        val second = server.takeRequest()
        assertTrue(first.path!!.contains("/upload/sessions/sess-3/sas-batch"))
        assertTrue(second.path!!.contains("/upload/sessions/sess-3/sas-batch"))
    }

    @Test
    fun sasBatch_mapsForbiddenAsDomainError() = runTest {
        server.enqueue(MockResponse().setResponseCode(403).setBody("forbidden"))

        val backend = BackendApi(
            baseUrl = server.url("/api/v1").toString().removeSuffix("/"),
            auth = NoAuthProvider,
            client = OkHttpClient(),
            maxRetries = 1,
            baseDelayMs = 1,
            maxDelayMs = 5,
        )

        try {
            backend.sasBatch(
                sessionId = "sess-4",
                body = SasBatchRequest(items = listOf(SasItem("uploads/a.jpg", "image/jpeg")))
            )
            throw AssertionError("Expected BackendForbidden")
        } catch (e: Err.UploadError.BackendForbidden) {
            assertTrue(e.message!!.contains("403"))
        }
    }

    @Test
    fun sasBatch_retriesOn429AndThenSucceeds() = runTest {
        server.enqueue(
            MockResponse()
                .setResponseCode(429)
                .addHeader("Retry-After", "0")
                .setBody("rate limited")
        )
        server.enqueue(
            MockResponse()
                .setResponseCode(200)
                .setHeader("Content-Type", "application/json")
                .setBody(
                    """
                    {"sas":[{"blobName":"uploads/a.jpg","url":"https://blob/sas-a","blobUrl":"https://blob/a","expiresOn":"2026-01-01T00:00:00Z"}]}
                    """.trimIndent()
                )
        )

        val backend = BackendApi(
            baseUrl = server.url("/api/v1").toString().removeSuffix("/"),
            auth = NoAuthProvider,
            client = OkHttpClient(),
            maxRetries = 2,
            baseDelayMs = 1,
            maxDelayMs = 5,
        )

        val resp = backend.sasBatch(
            sessionId = "sess-5",
            body = SasBatchRequest(items = listOf(SasItem("uploads/a.jpg", "image/jpeg")))
        )

        assertEquals(1, resp.sas.size)
        assertEquals(2, server.requestCount)
    }

    @Test
    fun sasBatch_mapsUnauthorizedAsDomainError() = runTest {
        server.enqueue(MockResponse().setResponseCode(401).setBody("unauthorized"))

        val backend = BackendApi(
            baseUrl = server.url("/api/v1").toString().removeSuffix("/"),
            auth = NoAuthProvider,
            client = OkHttpClient(),
            maxRetries = 1,
            baseDelayMs = 1,
            maxDelayMs = 5,
        )

        try {
            backend.sasBatch(
                sessionId = "sess-6",
                body = SasBatchRequest(items = listOf(SasItem("uploads/a.jpg", "image/jpeg")))
            )
            throw AssertionError("Expected BackendUnauthorized")
        } catch (e: Err.UploadError.BackendUnauthorized) {
            assertTrue(e.message!!.contains("401"))
        }
    }
}
