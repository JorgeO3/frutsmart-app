package expo.modules.skybolt.core.storage

import android.content.Context
import android.net.Uri
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import expo.modules.skybolt.proto.ItemRecord
import expo.modules.skybolt.proto.UploadSessionState.SessionStatus
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import java.util.UUID
import kotlin.system.measureTimeMillis

@RunWith(AndroidJUnit4::class)
class SessionRepositoryInstrumentationTest {

    private lateinit var context: Context
    private lateinit var repository: SessionRepository

    @Before
    fun setUp() {
        context = ApplicationProvider.getApplicationContext()
        repository = SessionRepository(context)
    }

    @After
    fun tearDown() {
        repository.closeAll()
    }

    @Test
    fun createOrLoadSession_isIdempotent() = runBlocking {
        val sessionId = randomSessionId()
        val item = newItem("item-1", 100L)

        repository.createOrLoadSession(sessionId, listOf(item), defaultOptions())
        repository.createOrLoadSession(sessionId, listOf(item, newItem("item-2", 200L)), defaultOptions())

        val state = repository.load(sessionId)
        assertEquals(sessionId, state.sessionId)
        assertEquals(1, state.itemsCount)
        assertEquals(SessionStatus.PREPARING, state.status)
    }

    @Test
    fun markItemCompleted_andFailed_updatesStatusAndCounters() = runBlocking {
        val sessionId = randomSessionId()
        repository.createOrLoadSession(
            sessionId,
            listOf(newItem("item-ok", 256L), newItem("item-fail", 128L)),
            defaultOptions(),
        )

        repository.markItemCompleted(sessionId, "item-ok")
        repository.markItemFailed(sessionId, "item-fail", "FileIo")

        val state = repository.load(sessionId)
        val ok = state.itemsList.first { it.clientItemId == "item-ok" }
        val fail = state.itemsList.first { it.clientItemId == "item-fail" }

        assertEquals(ItemRecord.Status.COMPLETED, ok.status)
        assertEquals(256L, ok.uploadedBytes)
        assertEquals(ItemRecord.Status.FAILED, fail.status)
        assertEquals("FileIo", fail.lastErrorCode)
        assertEquals(1, state.completedFiles)
        assertTrue(state.uploadedBytes >= 256L)
    }

    @Test
    fun listSessionsByStatus_returnsMatchingSessionsOnly() = runBlocking {
        val completedId = randomSessionId()
        val failedId = randomSessionId()

        repository.createOrLoadSession(completedId, listOf(newItem("a", 10)), defaultOptions())
        repository.createOrLoadSession(failedId, listOf(newItem("b", 10)), defaultOptions())

        repository.setSessionStatus(completedId, SessionStatus.COMPLETED)
        repository.setSessionStatus(failedId, SessionStatus.FAILED)

        val completed = repository.listSessionsByStatus(setOf(SessionStatus.COMPLETED))
        assertEquals(1, completed.size)
        assertEquals(completedId, completed.first().sessionId)

        val terminal = repository.listSessionsByStatus(setOf(SessionStatus.COMPLETED, SessionStatus.FAILED))
        assertEquals(2, terminal.size)
    }

    @Test
    fun progressBurstWrites_remainConsistentWithoutPathologicalSlowdown() = runBlocking {
        val sessionId = randomSessionId()
        val itemId = "item-burst"
        repository.createOrLoadSession(
            sessionId,
            listOf(newItem(itemId, 500_000L)),
            defaultOptions(),
        )

        val updates = 2_000
        val elapsedMs = measureTimeMillis {
            repeat(updates) { i ->
                repository.updateItemProgressCoalesced(
                    sessionId = sessionId,
                    clientItemId = itemId,
                    uploadedBytes = (i + 1L) * 250L,
                    nextBlockIndex = i + 1,
                    totalBlocks = updates,
                )
            }
            repository.flushCoalescer(sessionId)
        }

        val state = repository.load(sessionId)
        val item = state.itemsList.first { it.clientItemId == itemId }

        assertEquals(500_000L, item.uploadedBytes)
        assertEquals(500_000L, state.uploadedBytes)
        assertEquals(ItemRecord.Status.UPLOADING, item.status)
        assertTrue("Burst updates should stay under 8s, got ${elapsedMs}ms", elapsedMs < 8_000)
    }

    private fun defaultOptions() = SessionOptions(
        maxParallelFiles = 1,
        maxParallelChunks = 1,
        chunkSizeBytes = 1024,
        requiresWiFi = false,
        allowsCellular = true,
        lowPowerModeOkay = true,
    )

    private fun newItem(id: String, bytes: Long) = NewItem(
        clientItemId = id,
        localUri = Uri.parse("file:///tmp/$id.jpg"),
        blobName = "uploads/$id.jpg",
        contentType = "image/jpeg",
        totalBytes = bytes,
    )

    private fun randomSessionId(): String = "repo-${UUID.randomUUID()}"
}
