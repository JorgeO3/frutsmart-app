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
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.util.UUID
import kotlin.system.measureNanoTime
import kotlin.system.measureTimeMillis

@RunWith(AndroidJUnit4::class)
class SkyboltPerformanceInstrumentationTest {

    private lateinit var context: Context

    @Before
    fun setUp() {
        context = ApplicationProvider.getApplicationContext()
        SkyboltManager.initialize(context)
    }

    @Test
    fun configure_p95_under_300ms() = runBlocking {
        val samplesMs = mutableListOf<Long>()

        repeat(12) {
            val settings = buildSettings(concurrencyChunks = 2)
            val elapsedNs = measureNanoTime {
                runBlocking { SkyboltManager.configure(settings) }
            }
            samplesMs += elapsedNs / 1_000_000
        }

        val p95 = percentile(samplesMs, 95.0)
        println("[SkyboltPerf][androidTest] configure() p95=${p95}ms samples=${samplesMs.joinToString()}")
        assertTrue("configure() p95 should be < 300ms, got ${p95}ms", p95 < 300)
    }

    @Test
    fun initializeSession_10_files_p95_under_250ms() = runBlocking {
        SkyboltManager.configure(buildSettings(concurrencyChunks = 2))

        val samplesMs = mutableListOf<Long>()
        repeat(12) { idx ->
            val sessionId = "perf-init-$idx-${UUID.randomUUID()}"
            val sessionConfig = buildSessionConfig(sessionId, fileCount = 10, fileSizeBytes = 32 * 1024)

            val elapsedNs = measureNanoTime {
                runBlocking { SkyboltManager.initializeSession(sessionConfig) }
            }
            samplesMs += elapsedNs / 1_000_000
        }

        val p95 = percentile(samplesMs, 95.0)
        println("[SkyboltPerf][androidTest] initializeSession(10 files) p95=${p95}ms samples=${samplesMs.joinToString()}")
        assertTrue("initializeSession() p95 should be < 250ms, got ${p95}ms", p95 < 250)
    }

    @Test
    fun getSessionProgress_p95_under_50ms() = runBlocking {
        SkyboltManager.configure(buildSettings(concurrencyChunks = 2))

        val sessionId = "perf-progress-${UUID.randomUUID()}"
        SkyboltManager.initializeSession(buildSessionConfig(sessionId, fileCount = 10, fileSizeBytes = 16 * 1024))

        val samplesMs = mutableListOf<Long>()
        repeat(200) {
            val elapsedNs = measureNanoTime {
                runBlocking { SkyboltManager.getSessionProgress(sessionId) }
            }
            samplesMs += elapsedNs / 1_000_000
        }

        val p95 = percentile(samplesMs, 95.0)
        println("[SkyboltPerf][androidTest] getSessionProgress() p95=${p95}ms")
        assertTrue("getSessionProgress() p95 should be < 50ms, got ${p95}ms", p95 < 50)
    }

    @Test
    fun initializeSession_supports_mediumAndManySmallFileScenarios() = runBlocking {
        SkyboltManager.configure(buildSettings(concurrencyChunks = 2))

        val mediumSessionId = "perf-medium-${UUID.randomUUID()}"
        val mediumElapsedMs = measureTimeMillis {
            SkyboltManager.initializeSession(
                buildSessionConfig(
                    sessionId = mediumSessionId,
                    fileCount = 10,
                    fileSizeBytes = 5 * 1024 * 1024,
                )
            )
        }

        val manySmallSessionId = "perf-many-small-${UUID.randomUUID()}"
        val manySmallElapsedMs = measureTimeMillis {
            SkyboltManager.initializeSession(
                buildSessionConfig(
                    sessionId = manySmallSessionId,
                    fileCount = 50,
                    fileSizeBytes = 100 * 1024,
                )
            )
        }

        val mediumProgress = SkyboltManager.getSessionProgress(mediumSessionId)
        val manySmallProgress = SkyboltManager.getSessionProgress(manySmallSessionId)

        println(
            "[SkyboltPerf][androidTest] initializeSession scenarios: " +
                "10x5MB=${mediumElapsedMs}ms, 50x100KB=${manySmallElapsedMs}ms"
        )

        assertTrue(mediumProgress != null)
        assertTrue(manySmallProgress != null)
    }

    private fun buildSettings(concurrencyChunks: Int): CloudUploadSettings {
        return CloudUploadSettings(
            version = "1.0.0-perf",
            environment = "dev",
            backend = BackendConfig(
                baseUrl = "https://example.com",
                defaultHeaders = mapOf("x-test" to "perf"),
                endpoints = EndpointPaths(
                    sasBatchPath = "/upload/sessions/{sessionId}/sas-batch",
                    sasRefreshPath = "/upload/sessions/{sessionId}/sas/refresh",
                ),
                auth = AuthConfig(
                    tokenEndpoint = "https://example.com/oidc/token",
                    clientId = "perf-client",
                    scope = "api://perf/.default",
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
                maxParallelChunks = concurrencyChunks,
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
            val file = File(context.cacheDir, "perf-${sessionId}-$index.bin")
            if (!file.exists()) {
                file.writeBytes(ByteArray(fileSizeBytes) { (it % 97).toByte() })
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
                maxParallelFiles = 2,
                maxParallelChunks = 2,
                chunkSizeBytes = 512 * 1024,
                enableBackground = true,
                requiresWiFi = false,
                allowsCellular = true,
                lowPowerModeOkay = true,
            ),
        )
    }

    private fun percentile(samples: List<Long>, p: Double): Long {
        if (samples.isEmpty()) return 0
        val sorted = samples.sorted()
        val rank = ((p / 100.0) * (sorted.size - 1)).toInt().coerceIn(0, sorted.size - 1)
        return sorted[rank]
    }
}
