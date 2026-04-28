package expo.modules.skybolt.core.soak

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import expo.modules.skybolt.core.config.AuthConfig
import expo.modules.skybolt.core.config.AzureConfig
import expo.modules.skybolt.core.config.BackendConfig
import expo.modules.skybolt.core.config.CloudUploadSettings
import expo.modules.skybolt.core.config.ConcurrencyConfig
import expo.modules.skybolt.core.config.EndpointPaths
import expo.modules.skybolt.core.config.RetryConfig
import expo.modules.skybolt.core.facade.SkyboltManager
import expo.modules.skybolt.core.upload.api.ItemSpec
import expo.modules.skybolt.core.upload.api.SessionConfig
import expo.modules.skybolt.core.upload.api.StartOptions
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.util.UUID

@RunWith(AndroidJUnit4::class)
class SkyboltSoakInstrumentationTest {

    private lateinit var context: Context

    @Before
    fun setUp() = runBlocking {
        context = ApplicationProvider.getApplicationContext()
        SkyboltManager.initialize(context)
        SkyboltManager.configure(buildSettings())
    }

    @Test
    fun createsAndPurges_100_small_sessions_without_orphans() = runBlocking {
        val prefix = "soak-100-"
        repeat(100) { idx ->
            val sessionId = "$prefix$idx-${UUID.randomUUID()}"
            SkyboltManager.initializeSession(buildSessionConfig(sessionId, fileCount = 1, fileSizeBytes = 8 * 1024))
            SkyboltManager.cancelSession(sessionId)
        }

        val purged = SkyboltManager.purgeCompletedSessions(olderThanMs = 0)
        val active = SkyboltManager.listActiveSessions()
        val ownActive = active.filter { it.startsWith(prefix) }

        assertTrue("Expected to purge at least 100 sessions, got $purged", purged >= 100)
        assertEquals("No active soak sessions should remain", 0, ownActive.size)
    }

    @Test
    fun pauseResume_20_cycles_keeps_session_queryable() = runBlocking {
        val sessionId = "soak-pause-${UUID.randomUUID()}"
        SkyboltManager.initializeSession(buildSessionConfig(sessionId, fileCount = 2, fileSizeBytes = 16 * 1024))

        repeat(20) {
            SkyboltManager.pauseSession(sessionId)
            SkyboltManager.resumeSession(sessionId)
        }

        val progress = SkyboltManager.getSessionProgress(sessionId)
        assertTrue("Session progress should still be available after pause/resume cycles", progress != null)
        assertEquals(sessionId, progress?.sessionId)
    }

    private fun buildSettings(): CloudUploadSettings {
        return CloudUploadSettings(
            version = "1.0.0-soak",
            environment = "dev",
            backend = BackendConfig(
                baseUrl = "https://example.com",
                defaultHeaders = mapOf("x-test" to "soak"),
                endpoints = EndpointPaths(
                    sasBatchPath = "/upload/sessions/{sessionId}/sas-batch",
                    sasRefreshPath = "/upload/sessions/{sessionId}/sas/refresh",
                ),
                auth = AuthConfig(
                    tokenEndpoint = "https://example.com/oidc/token",
                    clientId = "soak-client",
                    scope = "api://soak/.default",
                    clockSkewMs = 30_000,
                ),
            ),
            azure = AzureConfig(
                serviceVersion = "2023-11-03",
                sendBlockMd5 = true,
                defaultChunkBytes = 1024 * 1024,
            ),
            concurrency = ConcurrencyConfig(
                maxParallelFiles = 2,
                maxParallelChunks = 2,
            ),
            retry = RetryConfig(
                maxRetries = 2,
                baseDelayMs = 10,
                maxDelayMs = 100,
            ),
        )
    }

    private fun buildSessionConfig(
        sessionId: String,
        fileCount: Int,
        fileSizeBytes: Int,
    ): SessionConfig {
        val items = (0 until fileCount).map { index ->
            val file = File(context.cacheDir, "soak-${sessionId}-$index.bin")
            if (!file.exists()) {
                file.writeBytes(ByteArray(fileSizeBytes) { (it % 89).toByte() })
            }

            ItemSpec(
                clientItemId = "item-$index-${UUID.randomUUID()}",
                localUri = file.toURI().toString(),
                blobName = "uploads/${file.name}",
                contentType = "application/octet-stream",
                sizeBytes = file.length(),
                md5Hex = null,
                metadata = emptyMap(),
            )
        }

        return SessionConfig(
            sessionId = sessionId,
            items = items,
            options = StartOptions(
                maxParallelFiles = 1,
                maxParallelChunks = 1,
                chunkSizeBytes = 256 * 1024,
                enableBackground = true,
                requiresWiFi = false,
                allowsCellular = true,
                lowPowerModeOkay = true,
            ),
        )
    }
}
