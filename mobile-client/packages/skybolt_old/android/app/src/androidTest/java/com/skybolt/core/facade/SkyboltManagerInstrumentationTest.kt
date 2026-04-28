package com.skybolt.core.facade

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.skybolt.core.config.AuthConfig
import com.skybolt.core.config.AzureConfig
import com.skybolt.core.config.BackendConfig
import com.skybolt.core.config.CloudUploadSettings
import com.skybolt.core.config.ConcurrencyConfig
import com.skybolt.core.config.EndpointPaths
import com.skybolt.core.config.RetryConfig
import com.skybolt.core.events.Events
import com.skybolt.core.upload.api.ItemSpec
import com.skybolt.core.upload.api.SessionConfig
import com.skybolt.core.upload.api.StartOptions
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.util.Collections
import java.util.UUID
import kotlin.system.measureTimeMillis

@RunWith(AndroidJUnit4::class)
class SkyboltManagerInstrumentationTest {

    private lateinit var context: Context
    private val emittedEvents = Collections.synchronizedList(mutableListOf<String>())
    private val resumedSessionIds = Collections.synchronizedList(mutableListOf<String>())

    @Before
    fun setUp() {
        context = ApplicationProvider.getApplicationContext()
        SkyboltManager.initialize(context)
        SkyboltManager.clearTestOverrides()
        emittedEvents.clear()
        resumedSessionIds.clear()
        Events.setSink { type, _ -> emittedEvents.add(type) }
    }

    @After
    fun tearDown() {
        Events.clear()
        SkyboltManager.clearTestOverrides()
    }

    @Test
    fun initialize_isIdempotent() {
        SkyboltManager.initialize(context)
        SkyboltManager.initialize(context)
        assertTrue(true)
    }

    @Test
    fun initializeSession_requiresConfigureThenAppearsInPendingAndActive() = runBlocking {
        ensureConfigured()

        val sessionId = "mgr-${UUID.randomUUID()}"
        SkyboltManager.initializeSession(buildSessionConfig(sessionId))

        val active = SkyboltManager.listActiveSessions()
        assertTrue(active.contains(sessionId))

        val pending = SkyboltManager.listPendingSessions()
        assertTrue(pending.any { it["sessionId"] == sessionId })

        val progress = SkyboltManager.getSessionProgress(sessionId)
        assertNotNull(progress)
        assertEquals(sessionId, progress?.sessionId)
    }

    @Test
    fun cancelSession_thenPurgeCompleted_removesSession() = runBlocking {
        ensureConfigured()

        val sessionId = "mgr-cancel-${UUID.randomUUID()}"
        SkyboltManager.initializeSession(buildSessionConfig(sessionId))
        SkyboltManager.cancelSession(sessionId)

        val purged = SkyboltManager.purgeCompletedSessions(olderThanMs = 0)
        assertTrue(purged >= 1)

        val active = SkyboltManager.listActiveSessions()
        assertTrue(!active.contains(sessionId))
    }

    @Test
    fun cleanupTempFiles_removesKnownTempPatterns() = runBlocking {
        ensureConfigured()

        val fileA = File(context.cacheDir, "skybolt_test_${UUID.randomUUID()}")
        val fileB = File(context.cacheDir, "worker_${UUID.randomUUID()}.tmp")
        val fileC = File(context.cacheDir, "part_${UUID.randomUUID()}.part")
        fileA.writeText("a")
        fileB.writeText("b")
        fileC.writeText("c")

        val cleaned = SkyboltManager.cleanupTempFiles()
        assertTrue(cleaned >= 3)
    }

    @Test
    fun pauseAndResumeSession_updatesPendingStateAndEmitsEvents() = runBlocking {
        ensureConfigured()

        val sessionId = "mgr-pause-${UUID.randomUUID()}"
        SkyboltManager.initializeSession(buildSessionConfig(sessionId))

        SkyboltManager.pauseSession(sessionId)
        val pendingAfterPause = SkyboltManager.listPendingSessions()
        assertTrue(
            pendingAfterPause.any {
                it["sessionId"] == sessionId && it["status"] == "PAUSED"
            }
        )

        SkyboltManager.resumeSession(sessionId)
        assertTrue(emittedEvents.contains("session:paused"))
        assertTrue(emittedEvents.contains("session:resumed"))
    }

    @Test
    fun startSession_doesNotThrowAndKeepsSessionQueryable() = runBlocking {
        ensureConfigured()

        val sessionId = "mgr-start-${UUID.randomUUID()}"
        SkyboltManager.initializeSession(buildSessionConfig(sessionId))
        SkyboltManager.startSession(sessionId)

        val progress = SkyboltManager.getSessionProgress(sessionId)
        assertNotNull(progress)
        assertEquals(sessionId, progress?.sessionId)
    }

    @Test
    fun authRefresh_autoResumesTrackedPausedSessions_locallyUnderFiveSeconds() = runBlocking {
        ensureConfigured()

        val sessionId = "mgr-auth-${UUID.randomUUID()}"
        SkyboltManager.initializeSession(buildSessionConfig(sessionId))
        SkyboltManager.pauseSession(sessionId)
        SkyboltManager.trackAuthPause(sessionId)
        SkyboltManager.enqueueSessionOverride = { resumedSessionIds.add(it) }

        val elapsedMs = measureTimeMillis {
            SkyboltManager.notifyAuthRefreshed()
        }

        assertTrue(elapsedMs < 5_000)
        assertTrue(resumedSessionIds.contains(sessionId))
    }

    @Test
    fun networkAutoResumePass_resumesTrackedPausedSessions_locallyUnderFiveSeconds() = runBlocking {
        ensureConfigured()

        val sessionId = "mgr-network-${UUID.randomUUID()}"
        SkyboltManager.initializeSession(buildSessionConfig(sessionId))
        SkyboltManager.pauseSession(sessionId)
        SkyboltManager.trackNetworkPause(sessionId)
        SkyboltManager.enqueueSessionOverride = { resumedSessionIds.add(it) }

        var resumedCount = 0
        val elapsedMs = measureTimeMillis {
            resumedCount = SkyboltManager.runAutoResumePassForTesting("network")["resumed"] ?: 0
        }

        assertTrue(elapsedMs < 5_000)
        assertTrue(resumedCount >= 1)
        assertTrue(resumedSessionIds.contains(sessionId))
    }

    private suspend fun ensureConfigured() {
        SkyboltManager.configure(
            CloudUploadSettings(
                version = "1.0.0-test",
                environment = "dev",
                backend = BackendConfig(
                    baseUrl = "https://example.com",
                    defaultHeaders = mapOf("x-test" to "1"),
                    endpoints = EndpointPaths(
                        sasBatchPath = "/upload/sessions/{sessionId}/sas-batch",
                        sasRefreshPath = "/upload/sessions/{sessionId}/sas/refresh",
                    ),
                    auth = AuthConfig(
                        tokenEndpoint = "https://example.com/oidc/token",
                        clientId = "test-client",
                        scope = "api://test/.default",
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
        )
    }

    private fun buildSessionConfig(sessionId: String): SessionConfig {
        val file = File.createTempFile("skybolt-manager", ".bin", context.cacheDir)
        file.writeBytes(ByteArray(256) { 1 })

        val item = ItemSpec(
            clientItemId = "item-${UUID.randomUUID()}",
            localUri = file.toURI().toString(),
            blobName = "uploads/${file.name}",
            contentType = "application/octet-stream",
            sizeBytes = file.length(),
            md5Hex = null,
            metadata = emptyMap(),
        )

        return SessionConfig(
            sessionId = sessionId,
            items = listOf(item),
            options = StartOptions(
                maxParallelFiles = 1,
                maxParallelChunks = 1,
                chunkSizeBytes = 1024,
                enableBackground = true,
                requiresWiFi = false,
                allowsCellular = true,
                lowPowerModeOkay = true,
            )
        )
    }
}
