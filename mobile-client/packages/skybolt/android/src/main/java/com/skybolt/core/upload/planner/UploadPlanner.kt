package com.skybolt.core.upload.planner

import com.skybolt.core.util.logger
import kotlin.collections.plusAssign

/**
 * Planificador de chunks para un archivo.
 * Crea el mapeo de índices -> rangos byte.
 */
object UploadPlanner {
    private val log by logger()

    fun planFor(sizeBytes: Long, chunkSizeBytes: Int, maxParallelChunks: Int = 1): UploadPlan {
        require(sizeBytes >= 0) { "sizeBytes < 0" }
        require(chunkSizeBytes > 0) { "chunkSizeBytes <= 0" }
        require(maxParallelChunks > 0) { "maxParallelChunks <= 0" }

        if (sizeBytes == 0L) {
            log.w { "Planning for empty file (0 bytes)" }
            return UploadPlan(
                totalBytes = 0,
                totalBlocks = 0,
                chunks = emptyList(),
                maxParallelChunks = maxParallelChunks
            )
        }

        val chunks = mutableListOf<Chunk>()
        var offset = 0L
        var index = 0

        while (offset < sizeBytes) {
            val remaining = sizeBytes - offset
            val size = kotlin.comparisons.minOf(remaining, chunkSizeBytes.toLong())
            chunks += Chunk(
                index = index,
                start = offset,
                endInclusive = offset + size - 1,
                size = size
            )
            offset += size
            index += 1
        }

        log.v { "Planned upload: size=$sizeBytes, chunkSize=$chunkSizeBytes, blocks=${chunks.size}" }

        return UploadPlan(
            totalBytes = sizeBytes,
            totalBlocks = chunks.size,
            chunks = chunks,
            maxParallelChunks = maxParallelChunks
        )
    }
}

