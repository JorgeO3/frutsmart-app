package expo.modules.skybolt.core.soak

import android.content.Context
import android.net.Uri
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.work.WorkManager
import expo.modules.skybolt.core.config.AuthConfig
import expo.modules.skybolt.core.config.AzureConfig
import expo.modules.skybolt.core.config.BackendConfig
import expo.modules.skybolt.core.config.CloudUploadSettings
import expo.modules.skybolt.core.config.ConcurrencyConfig
import expo.modules.skybolt.core.config.EndpointPaths
import expo.modules.skybolt.core.config.RetryConfig
import expo.modules.skybolt.core.facade.SkyboltManager
import expo.modules.skybolt.core.storage.NewItem
import expo.modules.skybolt.core.storage.SessionOptions
import expo.modules.skybolt.core.storage.SessionRepository
import expo.modules.skybolt.proto.UploadSessionState
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import java.util.UUID

@RunWith(AndroidJUnit4::class)
class SkyboltRecoveryInstrumentationTest {

    private lateinit var context: Context
    private lateinit var repository: SessionRepository
    private val resumedSessionIds = mutableListOf<String>()

    @Before
    fun setUp() = runBlocking {
        context = ApplicationProvider.getApplicationContext()
        repository = SessionRepository(context)
        resumedSessionIds.clear()

        clearLocalSessionState()
        WorkManager.getInstance(context).cancelAllWork()
        SkyboltManager.enqueueSessionOverride = { sessionId ->
            resumedSessionIds += sessionId
        }

        SkyboltManager.initialize(context)
        SkyboltManager.configure(buildSettings())
    }

    @After
    fun tearDown() {
        WorkManager.getInstance(context).cancelAllWork()
        SkyboltManager.clearTestOverrides()
        repository.closeAll()
    }

    @Test
    fun recoveryPass_marksUploadingAsPaused_simulatingProcessKill() = runBlocking {
        val sessionId = createSession("recovery-uploading")
        repository.setSessionStatus(sessionId, UploadSessionState.SessionStatus.UPLOADING)

        val stats = SkyboltManager.runRecoveryPassForTesting()
        val recovered = repository.load(sessionId)

        assertEquals(UploadSessionState.SessionStatus.PAUSED, recovered.status)
        assertTrue((stats["totalScanned"] ?: 0) >= 1)
        assertTrue((stats["pendingCount"] ?: 0) >= 1)
    }

    @Test
    fun recoveryPass_thenResumeAllPending_simulatesAppRestartFlow() = runBlocking {
        val sessionId = createSession("recovery-paused")
        repository.setSessionStatus(sessionId, UploadSessionState.SessionStatus.PAUSED)

        val stats = SkyboltManager.runRecoveryPassForTesting()
        val resumed = SkyboltManager.resumeAllPending()

        assertTrue((stats["pendingCount"] ?: 0) >= 1)
        assertTrue("Expected at least one resumed session", resumed >= 1)
        assertTrue(resumedSessionIds.contains(sessionId))

        val pending = SkyboltManager.listPendingSessions()
        assertTrue(pending.any { it["sessionId"] == sessionId })
    }

    private suspend fun createSession(prefix: String): String {
        val sessionId = "$prefix-${UUID.randomUUID()}"
        repository.createOrLoadSession(
            sessionId,
            listOf(
                NewItem(
                    clientItemId = "item-${UUID.randomUUID()}",
                    localUri = Uri.parse("file:///tmp/$sessionId.bin"),
                    blobName = "uploads/$sessionId.bin",
                    contentType = "application/octet-stream",
                    totalBytes = 4096L,
                )
            ),
            SessionOptions(
                maxParallelFiles = 1,
                maxParallelChunks = 1,
                chunkSizeBytes = 1024,
                requiresWiFi = false,
                allowsCellular = true,
                lowPowerModeOkay = true,
            )
        )
        return sessionId
    }

    private fun buildSettings(): CloudUploadSettings {
        return CloudUploadSettings(
            version = "1.0.0-recovery",
            environment = "dev",
            backend = BackendConfig(
                baseUrl = "https://example.com",
                defaultHeaders = mapOf("x-test" to "recovery"),
                endpoints = EndpointPaths(
                    sasBatchPath = "/upload/sessions/{sessionId}/sas-batch",
                    sasRefreshPath = "/upload/sessions/{sessionId}/sas/refresh",
                ),
                auth = AuthConfig(
                    tokenEndpoint = "https://example.com/oidc/token",
                    clientId = "recovery-client",
                    scope = "api://recovery/.default",
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

    private fun clearLocalSessionState() {
        val dataStoreDir = context.filesDir.resolve("datastore")
        val targets = dataStoreDir.listFiles()?.filter {
            it.name.startsWith("upload_session_") || it.name == "upload_sessions_index.pb"
        }.orEmpty()

        targets.forEach { file ->
            if (file.exists()) {
                file.delete()
            }
        }
    }
}
