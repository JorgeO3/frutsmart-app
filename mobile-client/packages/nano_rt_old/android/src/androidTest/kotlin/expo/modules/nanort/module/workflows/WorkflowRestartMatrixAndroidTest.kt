package expo.modules.nanort.module.workflows

import android.graphics.Bitmap
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.filters.LargeTest
import expo.modules.nanort.module.interpreter.ModelId
import expo.modules.nanort.module.interpreter.ModelManager
import expo.modules.nanort.module.interpreter.testing.NanoRtTestRule
import expo.modules.nanort.module.interpreter.testing.TestTimeouts
import expo.modules.nanort.module.interpreter.testing.ThreadIntrospection
import expo.modules.nanort.module.interpreter.testing.withTimeoutOrFail
import expo.modules.nanort.module.workflows.field.pipelines.FieldExternalClassificationPipeline
import expo.modules.nanort.module.workflows.field.pipelines.FieldInternalClassificationPipeline
import expo.modules.nanort.module.workflows.field.workflows.FieldSegmentationResult
import expo.modules.nanort.module.workflows.plant.pipelines.PlantExternalClassificationPipeline
import expo.modules.nanort.module.workflows.plant.pipelines.PlantInternalClassificationPipeline
import expo.modules.nanort.module.workflows.plant.workflows.PlantBunchResult
import expo.modules.nanort.module.workflows.plant.workflows.PlantSingleResult
import expo.modules.nanort.module.workflows.shared.base.AbstractSegmentationPipeline
import expo.modules.nanort.module.workflows.shared.segmentation.Segment
import expo.modules.nanort.module.workflows.shared.segmentation.SegmentationConfig
import expo.modules.nanort.module.workflows.shared.segmentation.SegmentationConfigs
import expo.modules.nanort.module.workflows.shared.segmentation.SegmentationWorkspace
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.opencv.android.Utils
import org.opencv.core.Mat

@RunWith(AndroidJUnit4::class)
@LargeTest
class WorkflowRestartMatrixAndroidTest {

  @get:Rule val rt = NanoRtTestRule(gpuEnabled = false)

  @Test
  fun restart_cycles_should_keep_all_workflow_families_operational() {
    runBlocking {
      val baselineThreads = ThreadIntrospection.countAliveThreadsWithNamePrefix("NanoRT-Thread")
      val baselineSnapshot = ModelManager.actorDebugSnapshotForSoak()

      val classBmp = Bitmap.createBitmap(224, 224, Bitmap.Config.ARGB_8888).also {
        it.eraseColor(0xFF66A57A.toInt())
      }
      val segBmp = Bitmap.createBitmap(640, 640, Bitmap.Config.ARGB_8888).also {
        it.eraseColor(0xFF4977A7.toInt())
      }

      val plantExternal = PlantExternalClassificationPipeline()
      val plantInternal = PlantInternalClassificationPipeline()
      val fieldExternal = FieldExternalClassificationPipeline()
      val fieldInternal = FieldInternalClassificationPipeline()
      val plantSeg = SegmentationBenchmarkPipeline(modelId = ModelId.RS, config = SegmentationConfigs.RING)
      val fieldSeg = SegmentationBenchmarkPipeline(modelId = ModelId.SS, config = SegmentationConfigs.SINGLE)

      val plantExternalInput = PlantBunchResult(
        sourceBitmap = classBmp,
        bunchSegments = emptyList(),
        segmentedBitmaps = listOf(classBmp)
      )
      val plantInternalInput = PlantSingleResult(
        sourceBitmap = classBmp,
        segmentedBitmaps = listOf(classBmp)
      )
      val fieldInput = FieldSegmentationResult(
        sourceBitmap = classBmp,
        segmentedBitmaps = listOf(classBmp)
      )

      val failures = mutableListOf<String>()

      suspend fun runStep(name: String, block: suspend () -> Unit) {
        val result = runCatching { block() }
        if (result.isFailure) {
          val err = result.exceptionOrNull()
          failures += "$name failed: ${err?.javaClass?.simpleName}: ${err?.message}"
        }
      }

      withTimeoutOrFail(TestTimeouts.STRESS_MS) {
        repeat(4) {
          runStep("plant_external") { plantExternal.execute(plantExternalInput) }
          runStep("plant_internal") { plantInternal.execute(plantInternalInput) }
          runStep("field_external") { fieldExternal.execute(fieldInput) }
          runStep("field_internal") { fieldInternal.execute(fieldInput) }
          runStep("plant_seg") { plantSeg.execute(segBmp) }
          runStep("field_seg") { fieldSeg.execute(segBmp) }

          runStep("shutdown") { ModelManager.shutdown() }

          runStep("restart_probe_plant_external") { plantExternal.execute(plantExternalInput) }
          runStep("restart_probe_field_seg") { fieldSeg.execute(segBmp) }
        }
      }

      val afterSnapshot = ModelManager.actorDebugSnapshotForSoak()
      val afterThreads = ThreadIntrospection.countAliveThreadsWithNamePrefix("NanoRT-Thread")

      assertTrue("Restart matrix had failures: $failures", failures.isEmpty())
      assertTrue("Actor reported fatal terminations", afterSnapshot.fatalTerminationCount == 0L)
      assertTrue("Actor has pending replies after restart matrix", afterSnapshot.pendingReplies == 0)
      assertTrue("Actor mailbox not drained after restart matrix", afterSnapshot.approxMailboxDepth == 0L)
      assertTrue(
        "Child jobs grew unexpectedly baseline=${baselineSnapshot.childJobCount} after=${afterSnapshot.childJobCount}",
        afterSnapshot.childJobCount <= baselineSnapshot.childJobCount + 2
      )
      assertTrue(
        "NanoRT thread delta too high baseline=$baselineThreads after=$afterThreads",
        afterThreads - baselineThreads <= 1
      )
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
}
