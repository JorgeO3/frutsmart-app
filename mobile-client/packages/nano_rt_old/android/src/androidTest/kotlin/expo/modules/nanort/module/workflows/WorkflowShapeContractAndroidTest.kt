package expo.modules.nanort.module.workflows

import android.graphics.Bitmap
import androidx.test.ext.junit.runners.AndroidJUnit4
import expo.modules.nanort.module.interpreter.ModelId
import expo.modules.nanort.module.interpreter.testing.NanoRtTestRule
import expo.modules.nanort.module.interpreter.testing.TestTimeouts
import expo.modules.nanort.module.interpreter.testing.withTimeoutOrFail
import expo.modules.nanort.module.workflows.shared.base.AbstractClassificationPipeline
import expo.modules.nanort.module.workflows.shared.base.AbstractSegmentationPipeline
import expo.modules.nanort.module.workflows.shared.classification.ClassificationConfig
import expo.modules.nanort.module.workflows.shared.classification.ClassificationConfigs
import expo.modules.nanort.module.workflows.shared.classification.ClassificationResult
import expo.modules.nanort.module.workflows.shared.segmentation.DetectionLayout
import expo.modules.nanort.module.workflows.shared.segmentation.Segment
import expo.modules.nanort.module.workflows.shared.segmentation.SegmentationConfig
import expo.modules.nanort.module.workflows.shared.segmentation.SegmentationConfigs
import expo.modules.nanort.module.workflows.shared.segmentation.SegmentationProcessor
import expo.modules.nanort.module.workflows.shared.segmentation.SegmentationWorkspace
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.opencv.android.Utils
import org.opencv.core.Mat

@RunWith(AndroidJUnit4::class)
class WorkflowShapeContractAndroidTest {

  @get:Rule val rt = NanoRtTestRule(gpuEnabled = false)

  @Test
  fun classification_and_segmentation_min_contracts_should_hold() {
    runBlocking {
      val clsPipeline = object : AbstractClassificationPipeline<List<Bitmap>, List<ClassificationResult>>() {
        override fun getModelId(): ModelId = ModelId.EC
        override fun getConfig(): ClassificationConfig = ClassificationConfigs.External
        override fun getBitmapsToProcess(input: List<Bitmap>): List<Bitmap> = input
        override fun buildOutput(
          input: List<Bitmap>,
          result: List<ClassificationResult>
        ): List<ClassificationResult> = result
      }

      val segPipeline = object : AbstractSegmentationPipeline<Bitmap, Int>() {
        override fun getModelId(): ModelId = ModelId.SS
        override fun getConfig(): SegmentationConfig = SegmentationConfigs.SINGLE
        override fun getBitmap(input: Bitmap): Mat = Mat().also { Utils.bitmapToMat(input, it) }
        override fun buildOutput(input: Bitmap, segments: List<Segment>, ws: SegmentationWorkspace): Int = segments.size
      }

      val clsBitmap = Bitmap.createBitmap(224, 224, Bitmap.Config.ARGB_8888).also {
        it.eraseColor(0xFF609C51.toInt())
      }
      val segBitmap = Bitmap.createBitmap(640, 640, Bitmap.Config.ARGB_8888).also {
        it.eraseColor(0xFF4D7EA9.toInt())
      }

      val clsResult = withTimeoutOrFail(TestTimeouts.LONG_MS) { clsPipeline.execute(listOf(clsBitmap)) }
      assertEquals("One input bitmap should yield one classification result", 1, clsResult.size)
      assertTrue("Classification confidences must not be empty", clsResult[0].confidences.isNotEmpty())

      val segCount = withTimeoutOrFail(TestTimeouts.LONG_MS) { segPipeline.execute(segBitmap) }
      assertTrue("Segmentation result count must be non-negative", segCount >= 0)

      clsBitmap.recycle()
      segBitmap.recycle()
    }
  }

  @Test
  fun segmentation_tensor_shape_parser_should_keep_layout_invariants() {
    val shapes = listOf(
      intArrayOf(1, 8400, 37),
      intArrayOf(1, 160, 160, 32),
    )
    val parsed = SegmentationProcessor.parseTensorShapes(shapes)

    assertEquals(160, parsed.maskH)
    assertEquals(160, parsed.maskW)
    assertEquals(32, parsed.maskC)
    assertEquals(DetectionLayout(false, 37, 8400, 0), parsed.detectionLayout)
  }
}
