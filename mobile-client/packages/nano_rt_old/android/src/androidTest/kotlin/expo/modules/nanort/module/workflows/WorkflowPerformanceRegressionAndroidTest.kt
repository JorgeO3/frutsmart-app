package expo.modules.nanort.module.workflows

import android.graphics.Bitmap
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.filters.LargeTest
import expo.modules.nanort.module.interpreter.InterpreterWarmer
import expo.modules.nanort.module.interpreter.ModelId
import expo.modules.nanort.module.interpreter.ModelManager
import expo.modules.nanort.module.interpreter.testing.NanoRtTestRule
import expo.modules.nanort.module.interpreter.testing.TestTimeouts
import expo.modules.nanort.module.interpreter.testing.ThreadIntrospection
import expo.modules.nanort.module.interpreter.testing.withTimeoutOrFail
import expo.modules.nanort.module.workflows.field.pipelines.FieldExternalClassificationPipeline
import expo.modules.nanort.module.workflows.field.workflows.FieldSegmentationResult
import expo.modules.nanort.module.workflows.plant.pipelines.PlantExternalClassificationPipeline
import expo.modules.nanort.module.workflows.plant.workflows.PlantBunchResult
import expo.modules.nanort.module.workflows.shared.base.AbstractSegmentationPipeline
import expo.modules.nanort.module.workflows.shared.segmentation.Segment
import expo.modules.nanort.module.workflows.shared.segmentation.SegmentationConfig
import expo.modules.nanort.module.workflows.shared.segmentation.SegmentationConfigs
import expo.modules.nanort.module.workflows.shared.segmentation.SegmentationWorkspace
import java.util.Locale
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.opencv.android.Utils
import org.opencv.core.Mat

@RunWith(AndroidJUnit4::class)
@LargeTest
class WorkflowPerformanceRegressionAndroidTest {

  @get:Rule val rt = NanoRtTestRule(gpuEnabled = false)

  @Test
  fun workflow_paths_should_remain_stable_without_fatals_or_leaks() {
    runBlocking {
      val baselineThreads = ThreadIntrospection.countAliveThreadsWithNamePrefix("NanoRT-Thread")
      val baselineMem = usedHeapBytes()

      withTimeoutOrFail(TestTimeouts.LONG_MS) {
        InterpreterWarmer.warmUp()
      }

      val baselineSnapshot = ModelManager.actorDebugSnapshotForSoak()

      val classBmp = Bitmap.createBitmap(224, 224, Bitmap.Config.ARGB_8888).also {
        it.eraseColor(0xFF5C9E66.toInt())
      }
      val segBmp = Bitmap.createBitmap(640, 640, Bitmap.Config.ARGB_8888).also {
        it.eraseColor(0xFF6B5CA5.toInt())
      }

      val plantClsPipeline = PlantExternalClassificationPipeline()
      val fieldClsPipeline = FieldExternalClassificationPipeline()

      val plantSegBench = SegmentationBenchmarkPipeline(
        modelId = ModelId.RS,
        config = SegmentationConfigs.RING,
      )
      val fieldSegBench = SegmentationBenchmarkPipeline(
        modelId = ModelId.SS,
        config = SegmentationConfigs.SINGLE,
      )

      val plantClsInput = PlantBunchResult(
        sourceBitmap = classBmp,
        bunchSegments = emptyList(),
        segmentedBitmaps = listOf(classBmp),
      )
      val fieldClsInput = FieldSegmentationResult(
        sourceBitmap = classBmp,
        segmentedBitmaps = listOf(classBmp),
      )

      val failures = mutableListOf<String>()
      val plantClsMs = mutableListOf<Double>()
      val fieldClsMs = mutableListOf<Double>()
      val plantSegMs = mutableListOf<Double>()
      val fieldSegMs = mutableListOf<Double>()

      suspend fun timed(name: String, sink: MutableList<Double>, block: suspend () -> Unit) {
        val t0 = System.nanoTime()
        val result = runCatching { block() }
        val ms = (System.nanoTime() - t0) / 1_000_000.0
        sink.add(ms)
        if (result.isFailure) {
          failures += "$name failed: ${result.exceptionOrNull()?.javaClass?.simpleName}: ${result.exceptionOrNull()?.message}"
        }
      }

      withTimeoutOrFail(TestTimeouts.STRESS_MS) {
        repeat(20) {
          timed("plant_cls", plantClsMs) { plantClsPipeline.execute(plantClsInput) }
          timed("field_cls", fieldClsMs) { fieldClsPipeline.execute(fieldClsInput) }
        }

        repeat(12) {
          timed("plant_seg", plantSegMs) { plantSegBench.execute(segBmp) }
          timed("field_seg", fieldSegMs) { fieldSegBench.execute(segBmp) }
        }

        repeat(4) {
          timed("shutdown", mutableListOf()) { ModelManager.shutdown() }
          timed("restart_probe", mutableListOf()) { plantClsPipeline.execute(plantClsInput) }
        }
      }

      val afterSnapshot = ModelManager.actorDebugSnapshotForSoak()
      val afterThreads = ThreadIntrospection.countAliveThreadsWithNamePrefix("NanoRT-Thread")
      val afterMem = usedHeapBytes()

      assertTrue("Workflow benchmark had operation failures: $failures", failures.isEmpty())
      assertTrue("Actor reported fatal terminations", afterSnapshot.fatalTerminationCount == 0L)
      assertTrue("Actor has pending replies after benchmark", afterSnapshot.pendingReplies == 0)
      assertTrue("Actor mailbox not drained after benchmark", afterSnapshot.approxMailboxDepth == 0L)

      val threadDelta = afterThreads - baselineThreads
      assertTrue("NanoRT thread delta too high baseline=$baselineThreads after=$afterThreads", threadDelta <= 1)

      assertTrue(
        "Child jobs grew unexpectedly baseline=${baselineSnapshot.childJobCount} after=${afterSnapshot.childJobCount}",
        afterSnapshot.childJobCount <= baselineSnapshot.childJobCount + 2
      )

      val memDeltaMb = (afterMem - baselineMem) / (1024.0 * 1024.0)
      assertTrue("Heap growth too high deltaMB=${String.format(Locale.US, "%.2f", memDeltaMb)}", memDeltaMb <= 160.0)

      assertTrue("Plant classification p95 too high: ${p95(plantClsMs)}ms", p95(plantClsMs) <= 600.0)
      assertTrue("Field classification p95 too high: ${p95(fieldClsMs)}ms", p95(fieldClsMs) <= 600.0)
      assertTrue("Plant segmentation p95 too high: ${p95(plantSegMs)}ms", p95(plantSegMs) <= 1500.0)
      assertTrue("Field segmentation p95 too high: ${p95(fieldSegMs)}ms", p95(fieldSegMs) <= 1500.0)
    }
  }

  private class SegmentationBenchmarkPipeline(
    private val modelId: ModelId,
    private val config: SegmentationConfig,
  ) : AbstractSegmentationPipeline<Bitmap, Int>() {
    override fun getModelId(): ModelId = modelId
    override fun getConfig(): SegmentationConfig = config
    override fun getBitmap(input: Bitmap): Mat = Mat().also { Utils.bitmapToMat(input, it) }
    override fun buildOutput(input: Bitmap, segments: List<Segment>, ws: SegmentationWorkspace): Int = segments.size
  }

  private fun usedHeapBytes(): Long {
    val runtime = Runtime.getRuntime()
    return runtime.totalMemory() - runtime.freeMemory()
  }

  private fun p95(values: List<Double>): Double {
    if (values.isEmpty()) return 0.0
    val sorted = values.sorted()
    val idx = ((sorted.size - 1) * 0.95).toInt().coerceIn(0, sorted.size - 1)
    return sorted[idx]
  }
}
