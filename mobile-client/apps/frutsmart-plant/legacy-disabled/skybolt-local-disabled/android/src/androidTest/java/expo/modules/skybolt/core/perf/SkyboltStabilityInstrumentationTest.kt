package expo.modules.skybolt.core.perf

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
import kotlinx.coroutines.withTimeout
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.util.UUID

@RunWith(AndroidJUnit4::class)
class SkyboltStabilityInstrumentationTest {

    private lateinit var context: Context

    @Before
    fun setUp() {
        context = ApplicationProvider.getApplicationContext()
        clearLocalSessionState()
        SkyboltManager.initialize(context)
        runBlocking {
            SkyboltManager.configure(buildSettings())
        }
    }

    @Test
    fun repeatedSessionLifecycle_hasBoundedHeapGrowth() = runBlocking {
        val baselineMb = usedHeapMb()
        var peakMb = baselineMb

        repeat(120) { index ->
            val sessionId = "stability-$index-${UUID.randomUUID()}"
            SkyboltManager.initializeSession(buildSessionConfig(sessionId, 2, 64 * 1024))

            if (index % 3 == 0) {
                SkyboltManager.pauseSession(sessionId)
                SkyboltManager.resumeSession(sessionId)
            }

            SkyboltManager.cancelSession(sessionId)

            if (index % 20 == 0) {
                val currentMb = usedHeapMb()
                if (currentMb > peakMb) peakMb = currentMb
            }
        }

        runCatching { SkyboltManager.purgeCompletedSessions(olderThanMs = 0) }
        forceGc()

        val finalMb = usedHeapMb()
        val growthMb = finalMb - baselineMb
        val peakGrowthMb = peakMb - baselineMb

        println(
            "[SkyboltStability][androidTest] heap baseline=${baselineMb}MB final=${finalMb}MB " +
                "growth=${growthMb}MB peakGrowth=${peakGrowthMb}MB"
        )

        assertTrue("Heap growth should remain below 160MB, got ${growthMb}MB", growthMb < 160)
        assertTrue("Peak heap growth should remain below 220MB, got ${peakGrowthMb}MB", peakGrowthMb < 220)
    }

    @Test
    fun recoveryAndResumeLoops_completeWithinTimeout_withoutHang() = runBlocking {
        withTimeout(20_000L) {
            repeat(40) { index ->
                val sessionId = "stability-recovery-$index-${UUID.randomUUID()}"
                SkyboltManager.initializeSession(buildSessionConfig(sessionId, 1, 32 * 1024))
                SkyboltManager.pauseSession(sessionId)
                SkyboltManager.trackNetworkPause(sessionId)
                SkyboltManager.runAutoResumePassForTesting("network")
                SkyboltManager.runRecoveryPassForTesting()
            }
        }

        assertTrue(true)
    }

    private fun buildSettings(): CloudUploadSettings {
        return CloudUploadSettings(
            version = "1.0.0-stability",
            environment = "dev",
            backend = BackendConfig(
                baseUrl = "https://example.com",
                defaultHeaders = mapOf("x-test" to "stability"),
                endpoints = EndpointPaths(
                    sasBatchPath = "/upload/sessions/{sessionId}/sas-batch",
                    sasRefreshPath = "/upload/sessions/{sessionId}/sas/refresh",
                ),
                auth = AuthConfig(
                    tokenEndpoint = "https://example.com/oidc/token",
                    clientId = "stability-client",
                    scope = "api://stability/.default",
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

    private fun buildSessionConfig(sessionId: String, fileCount: Int, fileSizeBytes: Int): SessionConfig {
        val items = (0 until fileCount).map { index ->
            val file = File(context.cacheDir, "stability-${sessionId}-$index.bin")
            if (!file.exists()) {
                file.writeBytes(ByteArray(fileSizeBytes) { (it % 71).toByte() })
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

    private fun clearLocalSessionState() {
        val dataStoreDir = context.filesDir.resolve("datastore")
        val targets = dataStoreDir.listFiles()?.filter {
            it.name.startsWith("upload_session_") || it.name == "upload_sessions_index.pb"
        }.orEmpty()

        targets.forEach { file ->
            if (file.exists()) file.delete()
        }
    }

    private fun usedHeapMb(): Long {
        forceGc()
        val runtime = Runtime.getRuntime()
        val usedBytes = runtime.totalMemory() - runtime.freeMemory()
        return usedBytes / (1024L * 1024L)
    }

    private fun forceGc() {
        repeat(2) {
            System.gc()
            System.runFinalization()
            Thread.sleep(50)
        }
    }
}
