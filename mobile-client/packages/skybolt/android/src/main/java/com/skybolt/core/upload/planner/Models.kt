package com.skybolt.core.upload.planner

/** Plan de subida por bloques. */
data class UploadPlan(
    val totalBytes: Long,
    val totalBlocks: Int,
    val chunks: List<Chunk>,
    val maxParallelChunks: Int = 1
)

/** Un bloque/chunk del archivo. */
data class Chunk(
    val index: Int,
    val start: Long,
    val endInclusive: Long,
    val size: Long
)
