package com.skybolt.core.perf

import com.skybolt.core.http.expBackoff
import com.skybolt.core.util.AppLogger
import com.skybolt.core.upload.planner.UploadPlanner
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import kotlin.system.measureNanoTime
import java.security.MessageDigest

class SkyboltPerformanceTest {

    @Before
    fun setUp() {
        AppLogger.disable()
    }

    @Test
    fun reportsUploadPlannerLatencyP95() {
        val samples = mutableListOf<Long>()
        repeat(200) {
            val nanos = measureNanoTime {
                UploadPlanner.planFor(
                    sizeBytes = 100L * 1024L * 1024L,
                    chunkSizeBytes = 4 * 1024 * 1024,
                    maxParallelChunks = 4,
                )
            }
            samples += nanos / 1_000_000
        }

        val p95 = percentile(samples, 95.0)
        println("[SkyboltPerformance] UploadPlanner.planFor(100MB) p95=${p95}ms")
        assertTrue(samples.isNotEmpty())
    }

    @Test
    fun reportsMd5InMemoryLatencyP95() {
        val payload = ByteArray(8 * 1024 * 1024) { (it % 127).toByte() }
        val samples = mutableListOf<Long>()

        repeat(40) {
            val nanos = measureNanoTime {
                MessageDigest.getInstance("MD5").digest(payload)
            }
            samples += nanos / 1_000_000
        }

        val p95 = percentile(samples, 95.0)
        println("[SkyboltPerformance] MD5 digest(8MB) p95=${p95}ms")
        assertTrue(samples.isNotEmpty())
    }

    @Test
    fun reportsRetryBackoffComputationLatencyP95() {
        val samples = mutableListOf<Long>()

        repeat(5_000) { n ->
            val attempt = (n % 10) + 1
            val nanos = measureNanoTime {
                expBackoff(attempt = attempt, baseDelayMs = 500L, maxDelayMs = 10_000L)
            }
            samples += nanos
        }

        val p95Ns = percentile(samples, 95.0)
        println("[SkyboltPerformance] expBackoff() p95=${p95Ns}ns")
        assertTrue(samples.isNotEmpty())
    }

    @Test
    fun reportsPlannerScenariosBySizeAndParallelism() {
        val sizes = listOf(
            100L * 1024L,
            1L * 1024L * 1024L,
            10L * 1024L * 1024L,
            100L * 1024L * 1024L,
        )
        val parallelisms = listOf(1, 2, 4)
        val chunkSize = 4 * 1024 * 1024

        for (size in sizes) {
            for (parallel in parallelisms) {
                val nanos = measureNanoTime {
                    UploadPlanner.planFor(
                        sizeBytes = size,
                        chunkSizeBytes = chunkSize,
                        maxParallelChunks = parallel,
                    )
                }
                val millis = nanos / 1_000_000
                println("[SkyboltPerformance] planner size=${size}B parallel=${parallel} took=${millis}ms")
                assertTrue(millis >= 0)
            }
        }
    }

    private fun percentile(samples: List<Long>, percentile: Double): Long {
        if (samples.isEmpty()) return 0L
        val sorted = samples.sorted()
        val rank = ((percentile / 100.0) * (sorted.size - 1)).toInt().coerceIn(0, sorted.size - 1)
        return sorted[rank]
    }
}
