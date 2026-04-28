package com.skybolt.azureblob.runtime

import android.content.Context
import android.net.Uri
import androidx.test.core.app.ApplicationProvider
import com.skybolt.azureblob.provider.SasProvider
import com.skybolt.core.upload.api.ItemSpec
import com.skybolt.core.upload.api.ProgressReporter
import com.skybolt.core.upload.planner.UploadPlanner
import com.skybolt.core.util.AppLogger
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.test.runTest
import okhttp3.OkHttpClient
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okhttp3.mockwebserver.SocketPolicy
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import java.io.File
import java.util.Base64
import java.util.concurrent.TimeUnit
import java.util.UUID
import java.util.concurrent.atomic.AtomicInteger

@RunWith(RobolectricTestRunner::class)
class BlobUploaderTest {

    private lateinit var server: MockWebServer
    private lateinit var context: Context

    @Before
    fun setUp() {
        AppLogger.disable()
        context = ApplicationProvider.getApplicationContext()
        server = MockWebServer()
        server.start()
    }

    @After
    fun tearDown() {
        server.shutdown()
    }

    @Test
    fun chunkedUpload_setsFinalBlobMd5OnCommit_evenWhenBlockMd5Disabled() = runTest {
        repeat(10) { server.enqueue(MockResponse().setResponseCode(201)) }

        val item = createItemSpec(sizeBytes = 3L * 1024L * 1024L)
        val plan = UploadPlanner.planFor(
            sizeBytes = item.sizeBytes,
            chunkSizeBytes = 1 * 1024 * 1024,
            maxParallelChunks = 2,
        )

        val uploader = BlobUploader(
            http = OkHttpClient.Builder()
                .callTimeout(5, TimeUnit.SECONDS)
                .connectTimeout(5, TimeUnit.SECONDS)
                .readTimeout(5, TimeUnit.SECONDS)
                .writeTimeout(5, TimeUnit.SECONDS)
                .build(),
            sasProvider = StaticSasProvider(server.url("/blob?sv=2023-11-03&sig=ok").toString()),
            maxRetries = 2,
            sendBlockMd5 = false,
            singlePutMaxBytes = 512 * 1024,
        )

        uploader.uploadBlockBlob(
            context = context,
            scope = CoroutineScope(Dispatchers.IO),
            sessionId = "s-${UUID.randomUUID()}",
            item = item,
            plan = plan,
            reporter = NoopProgressReporter,
        )

        val requests = (0 until (plan.totalBlocks + 1)).map {
            server.takeRequest(5, TimeUnit.SECONDS)
                ?: throw AssertionError("Timeout waiting request #$it")
        }
        val blockRequests = requests.filter { it.requestUrl?.queryParameter("comp") == "block" }
        val commitRequest = requests.first { it.requestUrl?.queryParameter("comp") == "blocklist" }

        assertEquals(plan.totalBlocks, blockRequests.size)
        blockRequests.forEach { request ->
            assertNull(request.getHeader("Content-MD5"))
        }

        val blobMd5 = commitRequest.getHeader("x-ms-blob-content-md5")
        assertNotNull(blobMd5)
        assertTrue(blobMd5!!.isNotBlank())
    }

    @Test
    fun retriesWithSasRefreshAfter403() = runTest {
        server.enqueue(MockResponse().setResponseCode(403).setBody("SAS expired"))
        server.enqueue(MockResponse().setResponseCode(201))

        val refreshCalls = AtomicInteger(0)
        val firstSas = server.url("/blob?sv=2023-11-03&sig=one").toString()
        val refreshedSas = server.url("/blob?sv=2023-11-03&sig=two").toString()

        val sasProvider = object : SasProvider {
            override suspend fun acquire(item: ItemSpec): String = firstSas
            override suspend fun refresh(item: ItemSpec): String {
                refreshCalls.incrementAndGet()
                return refreshedSas
            }
        }

        val item = createItemSpec(sizeBytes = 128L)
        val plan = UploadPlanner.planFor(item.sizeBytes, chunkSizeBytes = 128, maxParallelChunks = 1)

        val uploader = BlobUploader(
            http = OkHttpClient.Builder()
                .callTimeout(5, TimeUnit.SECONDS)
                .connectTimeout(5, TimeUnit.SECONDS)
                .readTimeout(5, TimeUnit.SECONDS)
                .writeTimeout(5, TimeUnit.SECONDS)
                .build(),
            sasProvider = sasProvider,
            maxRetries = 2,
            sendBlockMd5 = true,
            singlePutMaxBytes = 1024,
        )

        uploader.uploadBlockBlob(
            context = context,
            scope = CoroutineScope(Dispatchers.IO),
            sessionId = "s-${UUID.randomUUID()}",
            item = item,
            plan = plan,
            reporter = NoopProgressReporter,
        )

        val first = server.takeRequest(5, TimeUnit.SECONDS)
            ?: throw AssertionError("Timeout waiting first request")
        val second = server.takeRequest(5, TimeUnit.SECONDS)
            ?: throw AssertionError("Timeout waiting second request")

        assertTrue(first.path?.contains("sig=one") == true)
        assertTrue(second.path?.contains("sig=two") == true)
        assertEquals(1, refreshCalls.get())
    }

    @Test
    fun retriesAfter429UsingRetryAfterHeader() = runTest {
        server.enqueue(
            MockResponse()
                .setResponseCode(429)
                .addHeader("Retry-After", "0")
        )
        server.enqueue(MockResponse().setResponseCode(201))

        val item = createItemSpec(sizeBytes = 128L)
        val plan = UploadPlanner.planFor(item.sizeBytes, chunkSizeBytes = 128, maxParallelChunks = 1)

        val uploader = BlobUploader(
            http = OkHttpClient.Builder().callTimeout(5, TimeUnit.SECONDS).build(),
            sasProvider = StaticSasProvider(server.url("/blob?sv=2023-11-03&sig=ok").toString()),
            maxRetries = 2,
            sendBlockMd5 = true,
            baseDelayMs = 1,
            maxDelayMs = 5,
            singlePutMaxBytes = 1024,
        )

        uploader.uploadBlockBlob(
            context = context,
            scope = CoroutineScope(Dispatchers.IO),
            sessionId = "s-${UUID.randomUUID()}",
            item = item,
            plan = plan,
            reporter = NoopProgressReporter,
        )

        val first = server.takeRequest(5, TimeUnit.SECONDS)
        val second = server.takeRequest(5, TimeUnit.SECONDS)
        assertNotNull(first)
        assertNotNull(second)
    }

    @Test
    fun retriesAfterServer5xx() = runTest {
        server.enqueue(MockResponse().setResponseCode(500))
        server.enqueue(MockResponse().setResponseCode(201))

        val item = createItemSpec(sizeBytes = 128L)
        val plan = UploadPlanner.planFor(item.sizeBytes, chunkSizeBytes = 128, maxParallelChunks = 1)

        val uploader = BlobUploader(
            http = OkHttpClient.Builder().callTimeout(5, TimeUnit.SECONDS).build(),
            sasProvider = StaticSasProvider(server.url("/blob?sv=2023-11-03&sig=ok").toString()),
            maxRetries = 2,
            sendBlockMd5 = true,
            baseDelayMs = 1,
            maxDelayMs = 5,
            singlePutMaxBytes = 1024,
        )

        uploader.uploadBlockBlob(
            context = context,
            scope = CoroutineScope(Dispatchers.IO),
            sessionId = "s-${UUID.randomUUID()}",
            item = item,
            plan = plan,
            reporter = NoopProgressReporter,
        )

        val first = server.takeRequest(5, TimeUnit.SECONDS)
        val second = server.takeRequest(5, TimeUnit.SECONDS)
        assertNotNull(first)
        assertNotNull(second)
    }

    @Test
    fun retriesAfterNetworkIoError() = runTest {
        server.enqueue(
            MockResponse().setSocketPolicy(SocketPolicy.DISCONNECT_AT_START)
        )
        server.enqueue(MockResponse().setResponseCode(201))

        val item = createItemSpec(sizeBytes = 128L)
        val plan = UploadPlanner.planFor(item.sizeBytes, chunkSizeBytes = 128, maxParallelChunks = 1)

        val uploader = BlobUploader(
            http = OkHttpClient.Builder().callTimeout(5, TimeUnit.SECONDS).build(),
            sasProvider = StaticSasProvider(server.url("/blob?sv=2023-11-03&sig=ok").toString()),
            maxRetries = 2,
            sendBlockMd5 = true,
            baseDelayMs = 1,
            maxDelayMs = 5,
            singlePutMaxBytes = 1024,
        )

        uploader.uploadBlockBlob(
            context = context,
            scope = CoroutineScope(Dispatchers.IO),
            sessionId = "s-${UUID.randomUUID()}",
            item = item,
            plan = plan,
            reporter = NoopProgressReporter,
        )

        val first = server.takeRequest(5, TimeUnit.SECONDS)
        val second = server.takeRequest(5, TimeUnit.SECONDS)
        assertNotNull(first)
        assertNotNull(second)
    }

    @Test
    fun failsFastWhenSasKeepsExpiringWithoutInfiniteLoop() = runTest {
        server.enqueue(MockResponse().setResponseCode(403))
        server.enqueue(MockResponse().setResponseCode(403))

        val refreshCalls = AtomicInteger(0)
        val sasProvider = object : SasProvider {
            override suspend fun acquire(item: ItemSpec): String = server.url("/blob?sv=2023-11-03&sig=first").toString()
            override suspend fun refresh(item: ItemSpec): String {
                refreshCalls.incrementAndGet()
                return server.url("/blob?sv=2023-11-03&sig=refreshed").toString()
            }
        }

        val item = createItemSpec(sizeBytes = 128L)
        val plan = UploadPlanner.planFor(item.sizeBytes, chunkSizeBytes = 128, maxParallelChunks = 1)

        val uploader = BlobUploader(
            http = OkHttpClient.Builder().callTimeout(5, TimeUnit.SECONDS).build(),
            sasProvider = sasProvider,
            maxRetries = 1,
            sendBlockMd5 = true,
            baseDelayMs = 1,
            maxDelayMs = 5,
            singlePutMaxBytes = 1024,
        )

        try {
            uploader.uploadBlockBlob(
                context = context,
                scope = CoroutineScope(Dispatchers.IO),
                sessionId = "s-${UUID.randomUUID()}",
                item = item,
                plan = plan,
                reporter = NoopProgressReporter,
            )
            throw AssertionError("Expected SasExpired")
        } catch (_: com.skybolt.core.upload.api.Err.UploadError.SasExpired) {
            // expected
        }

        assertEquals(1, refreshCalls.get())
    }

    @Test
    fun commitBlockList_preservesBlockIdOrder() = runTest {
        repeat(10) { server.enqueue(MockResponse().setResponseCode(201)) }

        val item = createItemSpec(sizeBytes = 3L * 1024L * 1024L)
        val plan = UploadPlanner.planFor(
            sizeBytes = item.sizeBytes,
            chunkSizeBytes = 1 * 1024 * 1024,
            maxParallelChunks = 4,
        )

        val uploader = BlobUploader(
            http = OkHttpClient.Builder().callTimeout(5, TimeUnit.SECONDS).build(),
            sasProvider = StaticSasProvider(server.url("/blob?sv=2023-11-03&sig=ok").toString()),
            maxRetries = 2,
            sendBlockMd5 = true,
            baseDelayMs = 1,
            maxDelayMs = 5,
            singlePutMaxBytes = 512 * 1024,
        )

        uploader.uploadBlockBlob(
            context = context,
            scope = CoroutineScope(Dispatchers.IO),
            sessionId = "sess-fixed",
            item = item.copy(clientItemId = "item-fixed"),
            plan = plan,
            reporter = NoopProgressReporter,
        )

        val requests = (0 until (plan.totalBlocks + 1)).map {
            server.takeRequest(5, TimeUnit.SECONDS) ?: throw AssertionError("Timeout waiting request #$it")
        }
        val commitRequest = requests.first { it.requestUrl?.queryParameter("comp") == "blocklist" }
        val xml = commitRequest.body.readUtf8()

        val ids = Regex("<Latest>(.*?)</Latest>")
            .findAll(xml)
            .map { it.groupValues[1] }
            .toList()

        assertEquals(plan.totalBlocks, ids.size)

        val indices = ids.map { idB64 ->
            val decoded = String(Base64.getDecoder().decode(idB64))
            val suffix = Regex("(\\d{16})$").find(decoded)?.groupValues?.get(1)
                ?: throw AssertionError("Unable to parse index from decoded blockId=$decoded")
            suffix.toInt()
        }

        assertEquals(indices.sorted(), indices)
    }

    private fun createItemSpec(sizeBytes: Long): ItemSpec {
        val data = ByteArray(sizeBytes.toInt()) { (it % 127).toByte() }
        val file = File.createTempFile("skybolt-test", ".bin", context.cacheDir)
        file.writeBytes(data)

        return ItemSpec(
            clientItemId = "item-${UUID.randomUUID()}",
            localUri = Uri.fromFile(file).toString(),
            blobName = "uploads/${file.name}",
            contentType = "application/octet-stream",
            sizeBytes = sizeBytes,
            md5Hex = null,
            metadata = emptyMap(),
        )
    }
}

private class StaticSasProvider(
    private val sas: String,
) : SasProvider {
    override suspend fun acquire(item: ItemSpec): String = sas
    override suspend fun refresh(item: ItemSpec): String = sas
}

private object NoopProgressReporter : ProgressReporter {
    override fun onItemProgress(progress: com.skybolt.core.upload.api.ItemProgress) = Unit
    override fun onItemCompleted(clientItemId: String) = Unit
}
