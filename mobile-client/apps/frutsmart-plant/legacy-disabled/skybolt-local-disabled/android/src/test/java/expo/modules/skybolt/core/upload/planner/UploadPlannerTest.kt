package expo.modules.skybolt.core.upload.planner

import expo.modules.skybolt.core.util.AppLogger
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test

class UploadPlannerTest {

    @Before
    fun disableAndroidLogSinkForJvmTests() {
        AppLogger.disable()
    }

    @Test
    fun planFor_splitsFileByChunkSize() {
        val plan = UploadPlanner.planFor(
            sizeBytes = 10L,
            chunkSizeBytes = 4,
            maxParallelChunks = 3,
        )

        assertEquals(10L, plan.totalBytes)
        assertEquals(3, plan.totalBlocks)
        assertEquals(3, plan.maxParallelChunks)

        assertEquals(0L, plan.chunks[0].start)
        assertEquals(3L, plan.chunks[0].endInclusive)

        assertEquals(4L, plan.chunks[1].start)
        assertEquals(7L, plan.chunks[1].endInclusive)

        assertEquals(8L, plan.chunks[2].start)
        assertEquals(9L, plan.chunks[2].endInclusive)
    }

    @Test
    fun planFor_handlesEmptyFile() {
        val plan = UploadPlanner.planFor(
            sizeBytes = 0L,
            chunkSizeBytes = 4,
            maxParallelChunks = 2,
        )

        assertEquals(0, plan.totalBlocks)
        assertEquals(2, plan.maxParallelChunks)
        assertEquals(0, plan.chunks.size)
    }
}
