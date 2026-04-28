package expo.modules.skybolt.core.bg

import android.content.Context
import android.net.Uri
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.work.Data
import androidx.work.ListenableWorker
import androidx.work.Configuration
import androidx.work.testing.TestListenableWorkerBuilder
import androidx.work.testing.WorkManagerTestInitHelper
import expo.modules.skybolt.core.events.Events
import expo.modules.skybolt.core.facade.SkyboltManager
import expo.modules.skybolt.proto.UploadSessionState
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import expo.modules.skybolt.core.storage.NewItem
import expo.modules.skybolt.core.storage.SessionOptions
import expo.modules.skybolt.core.storage.SessionRepository
import java.util.Collections
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.CancellationException
import org.junit.After
import org.junit.Before
import java.util.UUID

@RunWith(AndroidJUnit4::class)
class UploadWorkerInstrumentationTest {

    private lateinit var context: Context
    private val emittedEvents = Collections.synchronizedList(mutableListOf<String>())

    @Before
    fun setUp() {
        context = ApplicationProvider.getApplicationContext()
        UploadWorker.clearTestOverrides()
        emittedEvents.clear()
        Events.setSink { type, _ -> emittedEvents.add(type) }
    }

    @After
    fun tearDown() {
        Events.clear()
        UploadWorker.clearTestOverrides()
    }

    @Test
    fun initializesWorkManagerTestHarness() {
        val config = Configuration.Builder()
            .setMinimumLoggingLevel(android.util.Log.DEBUG)
            .build()

        WorkManagerTestInitHelper.initializeTestWorkManager(context, config)
        val instance = WorkManagerTestInitHelper.getTestDriver(context)

        assertNotNull(instance)
    }

    @Test
    fun workerReturnsFailureWhenSessionIdIsMissing() {
        val worker = TestListenableWorkerBuilder<UploadWorker>(context)
            .setInputData(Data.EMPTY)
            .build()

        val result = worker.startWork().get()
        assertEquals(ListenableWorker.Result.failure(), result)
    }

    @Test
    fun workerReturnsFailureWhenSessionDoesNotExist() {
        val randomSessionId = "missing-${UUID.randomUUID()}"

        val worker = TestListenableWorkerBuilder<UploadWorker>(context)
            .setInputData(
                Data.Builder()
                    .putString(UploadWorker.KEY_SESSION_ID, randomSessionId)
                    .build()
            )
            .build()

        val result = worker.startWork().get()
        assertEquals(ListenableWorker.Result.failure(), result)
    }

    @Test
    fun workerPausesSessionWhenNetworkIsDisconnected() {
        val sessionId = createSession()
        UploadWorker.networkConnectedOverride = { false }

        val worker = TestListenableWorkerBuilder<UploadWorker>(context)
            .setInputData(
                Data.Builder().putString(UploadWorker.KEY_SESSION_ID, sessionId).build()
            )
            .build()

        val result = worker.startWork().get()
        assertEquals(ListenableWorker.Result.failure(), result)

        val repo = SessionRepository(context)
        val session = runBlocking { repo.load(sessionId) }
        assertEquals(UploadSessionState.SessionStatus.PAUSED, session.status)
        repo.closeAll()
    }

    @Test
    fun workerReturnsRetryWhenUploadSignalsRetryLater() {
        val sessionId = createSession()
        UploadWorker.networkConnectedOverride = { true }
        UploadWorker.uploadSessionOverride = { _, _, _ -> throw Halt.RetryLater() }

        val worker = TestListenableWorkerBuilder<UploadWorker>(context)
            .setInputData(
                Data.Builder().putString(UploadWorker.KEY_SESSION_ID, sessionId).build()
            )
            .build()

        val result = worker.startWork().get()
        assertEquals(ListenableWorker.Result.retry(), result)
    }

    @Test
    fun workerCancelDuringRetryRequest_marksSessionCanceled() = runBlocking {
        val sessionId = createSession()
        SkyboltManager.initialize(context)
        UploadWorker.networkConnectedOverride = { true }
        UploadWorker.uploadSessionOverride = { _, _, _ -> throw Halt.RetryLater() }
        UploadWorker.onRetryRequestedOverride = { sid ->
            SkyboltManager.cancelSession(sid)
        }

        val worker = TestListenableWorkerBuilder<UploadWorker>(context)
            .setInputData(
                Data.Builder().putString(UploadWorker.KEY_SESSION_ID, sessionId).build()
            )
            .build()

        val result = worker.startWork().get()
        assertEquals(ListenableWorker.Result.retry(), result)

        val repo = SessionRepository(context)
        val session = repo.load(sessionId)
        assertEquals(UploadSessionState.SessionStatus.CANCELED, session.status)
        repo.closeAll()
    }

    @Test
    fun workerMarksPausedWhenUploadSignalsAuthPause() {
        val sessionId = createSession()
        UploadWorker.networkConnectedOverride = { true }
        UploadWorker.uploadSessionOverride = { _, _, _ -> throw Halt.AuthPause() }

        val worker = TestListenableWorkerBuilder<UploadWorker>(context)
            .setInputData(
                Data.Builder().putString(UploadWorker.KEY_SESSION_ID, sessionId).build()
            )
            .build()

        val result = worker.startWork().get()
        assertEquals(ListenableWorker.Result.failure(), result)

        val repo = SessionRepository(context)
        val session = runBlocking { repo.load(sessionId) }
        assertEquals(UploadSessionState.SessionStatus.PAUSED, session.status)
        repo.closeAll()
    }

    @Test
    fun workerMarksCompletedAndEmitsCompletedEventOnSuccess() {
        val sessionId = createSession()
        UploadWorker.networkConnectedOverride = { true }
        UploadWorker.uploadSessionOverride = { _, _, _ -> Result.success(Unit) }

        val worker = TestListenableWorkerBuilder<UploadWorker>(context)
            .setInputData(
                Data.Builder().putString(UploadWorker.KEY_SESSION_ID, sessionId).build()
            )
            .build()

        val result = worker.startWork().get()
        assertEquals(ListenableWorker.Result.success(), result)

        val repo = SessionRepository(context)
        val session = runBlocking { repo.load(sessionId) }
        assertEquals(UploadSessionState.SessionStatus.COMPLETED, session.status)
        repo.closeAll()

        assertTrue(emittedEvents.contains("session:started"))
        assertTrue(emittedEvents.contains("session:completed"))
    }

    @Test
    fun workerMarksCanceledAndEmitsCanceledEventOnCancellation() {
        val sessionId = createSession()
        UploadWorker.networkConnectedOverride = { true }
        UploadWorker.uploadSessionOverride = { _, _, _ -> throw CancellationException("cancel test") }

        val worker = TestListenableWorkerBuilder<UploadWorker>(context)
            .setInputData(
                Data.Builder().putString(UploadWorker.KEY_SESSION_ID, sessionId).build()
            )
            .build()

        val result = worker.startWork().get()
        assertEquals(ListenableWorker.Result.success(), result)

        val repo = SessionRepository(context)
        val session = runBlocking { repo.load(sessionId) }
        assertEquals(UploadSessionState.SessionStatus.CANCELED, session.status)
        repo.closeAll()

        assertTrue(emittedEvents.contains("session:canceled"))
    }

    private fun createSession(): String {
        val sessionId = "session-${UUID.randomUUID()}"
        val repo = SessionRepository(context)
        runBlocking {
            repo.createOrLoadSession(
                sessionId = sessionId,
                items = listOf(
                    NewItem(
                        clientItemId = "item-1",
                        localUri = Uri.parse("file:///tmp/item-1.jpg"),
                        blobName = "uploads/item-1.jpg",
                        contentType = "image/jpeg",
                        totalBytes = 128L,
                    )
                ),
                options = SessionOptions(
                    maxParallelFiles = 1,
                    maxParallelChunks = 1,
                    chunkSizeBytes = 1024,
                    requiresWiFi = false,
                    allowsCellular = true,
                    lowPowerModeOkay = true,
                )
            )
        }
        repo.closeAll()
        return sessionId
    }
}
