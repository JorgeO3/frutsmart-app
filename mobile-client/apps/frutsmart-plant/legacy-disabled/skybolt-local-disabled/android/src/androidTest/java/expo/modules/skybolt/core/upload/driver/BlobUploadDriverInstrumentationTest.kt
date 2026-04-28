package expo.modules.skybolt.core.upload.driver

import android.content.Context
import android.net.Uri
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import expo.modules.skybolt.core.bg.Halt
import expo.modules.skybolt.core.storage.NewItem
import expo.modules.skybolt.core.storage.SessionOptions
import expo.modules.skybolt.core.storage.SessionRepository
import expo.modules.skybolt.core.upload.api.Err
import expo.modules.skybolt.core.upload.api.ItemSpec
import expo.modules.skybolt.core.upload.api.LowLevelUploader
import expo.modules.skybolt.core.upload.api.ProgressReporter
import expo.modules.skybolt.core.upload.api.ItemProgress
import expo.modules.skybolt.core.upload.planner.UploadPlan
import expo.modules.skybolt.proto.ItemRecord
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import java.util.UUID

@RunWith(AndroidJUnit4::class)
class BlobUploadDriverInstrumentationTest {

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
    fun uploadSession_marksItemFailedOnNonFatalUploadError() = runBlocking {
        val sessionId = createSession("driver-nonfatal")
        val session = repository.load(sessionId)

        val driver = BlobDriver(
            context = context,
            lowLevel = object : LowLevelUploader {
                override suspend fun uploadBlockBlob(
                    context: Context,
                    scope: kotlinx.coroutines.CoroutineScope,
                    sessionId: String,
                    item: ItemSpec,
                    plan: UploadPlan,
                    reporter: ProgressReporter,
                ) {
                    throw Err.UploadError.FileIo("forced file io")
                }
            },
            sessionRepository = repository,
        )

        driver.uploadSession(this, session, Channel<ItemProgress>(Channel.BUFFERED))

        val state = repository.load(sessionId)
        assertEquals(ItemRecord.Status.FAILED, state.getItems(0).status)
    }

    @Test
    fun uploadSession_throwsHaltOnRetryableNetworkError() = runBlocking {
        val sessionId = createSession("driver-halt")
        val session = repository.load(sessionId)

        val driver = BlobDriver(
            context = context,
            lowLevel = object : LowLevelUploader {
                override suspend fun uploadBlockBlob(
                    context: Context,
                    scope: kotlinx.coroutines.CoroutineScope,
                    sessionId: String,
                    item: ItemSpec,
                    plan: UploadPlan,
                    reporter: ProgressReporter,
                ) {
                    throw Err.UploadError.NetUnavailable("forced net down")
                }
            },
            sessionRepository = repository,
        )

        try {
            driver.uploadSession(this, session, Channel<ItemProgress>(Channel.BUFFERED))
            throw AssertionError("Expected Halt.NetworkPause")
        } catch (halt: Halt.NetworkPause) {
            assertTrue(halt is Halt.NetworkPause)
        }
    }

    private suspend fun createSession(prefix: String): String {
        val sessionId = "$prefix-${UUID.randomUUID()}"
        repository.createOrLoadSession(
            sessionId,
            listOf(
                NewItem(
                    clientItemId = "item-1",
                    localUri = Uri.parse("file:///tmp/item-1.jpg"),
                    blobName = "uploads/item-1.jpg",
                    contentType = "image/jpeg",
                    totalBytes = 128L,
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
}
