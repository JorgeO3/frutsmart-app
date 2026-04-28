package expo.modules.nanort.module.workflows

import android.graphics.Bitmap
import android.os.Debug
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
class DirectMemoryObservationAndroidTest {

  @get:Rule val rt = NanoRtTestRule(gpuEnabled = false)

  @Test
  fun repeated_workflows_should_not_show_severe_native_memory_growth() {
    runBlocking {
      val baselineThreads = ThreadIntrospection.countAliveThreadsWithNamePrefix("NanoRT-Thread")

      withTimeoutOrFail(TestTimeouts.LONG_MS) {
        InterpreterWarmer.warmUp()
      }

      forceGcPause()
      val baselineManaged = usedHeapBytes()
      val baselineNative = Debug.getNativeHeapAllocatedSize()

      val classBmp = Bitmap.createBitmap(224, 224, Bitmap.Config.ARGB_8888).also {
        it.eraseColor(0xFF4FA27A.toInt())
      }
      val segBmp = Bitmap.createBitmap(640, 640, Bitmap.Config.ARGB_8888).also {
        it.eraseColor(0xFF466DA4.toInt())
      }

      val fieldExternal = FieldExternalClassificationPipeline()
      val fieldInput = FieldSegmentationResult(sourceBitmap = classBmp, segmentedBitmaps = listOf(classBmp))
      val segPipeline = SegmentationBenchmarkPipeline(modelId = ModelId.SS, config = SegmentationConfigs.SINGLE)

      withTimeoutOrFail(TestTimeouts.STRESS_MS) {
        repeat(24) { i ->
          fieldExternal.execute(fieldInput)
          segPipeline.execute(segBmp)
          if ((i + 1) % 6 == 0) {
            ModelManager.releaseCurrentSession()
            forceGcPause()
          }
        }
      }

      forceGcPause()
      val finalManaged = usedHeapBytes()
      val finalNative = Debug.getNativeHeapAllocatedSize()
      val snapshot = ModelManager.actorDebugSnapshotForSoak()
      val afterThreads = ThreadIntrospection.countAliveThreadsWithNamePrefix("NanoRT-Thread")

      val managedDeltaMb = toMb(finalManaged - baselineManaged)
      val nativeDeltaMb = toMb(finalNative - baselineNative)

      assertTrue(
        "Managed heap delta too high: ${String.format(Locale.US, "%.2f", managedDeltaMb)}MB",
        managedDeltaMb <= 220.0
      )
      assertTrue(
        "Native heap delta too high: ${String.format(Locale.US, "%.2f", nativeDeltaMb)}MB",
        nativeDeltaMb <= 220.0
      )
      assertTrue("Actor reported fatal terminations", snapshot.fatalTerminationCount == 0L)
      assertTrue("Actor has pending replies after memory test", snapshot.pendingReplies == 0)
      assertTrue("Actor mailbox not drained after memory test", snapshot.approxMailboxDepth == 0L)
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

  private fun usedHeapBytes(): Long {
    val runtime = Runtime.getRuntime()
    return runtime.totalMemory() - runtime.freeMemory()
  }

  private fun toMb(bytes: Long): Double = bytes / (1024.0 * 1024.0)

  private fun forceGcPause() {
    System.gc()
    System.runFinalization()
    Thread.sleep(120)
  }
}
