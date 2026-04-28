package expo.modules.nanort.module.workflows

import android.graphics.Bitmap
import androidx.test.ext.junit.runners.AndroidJUnit4
import expo.modules.nanort.module.interpreter.ModelId
import expo.modules.nanort.module.interpreter.WorkspaceManager
import expo.modules.nanort.module.interpreter.testing.NanoRtTestRule
import expo.modules.nanort.module.interpreter.testing.TestTimeouts
import expo.modules.nanort.module.interpreter.testing.withTimeoutOrFail
import expo.modules.nanort.module.workflows.shared.base.AbstractClassificationPipeline
import expo.modules.nanort.module.workflows.shared.base.AbstractSegmentationPipeline
import expo.modules.nanort.module.workflows.shared.classification.ClassificationConfig
import expo.modules.nanort.module.workflows.shared.classification.ClassificationConfigs
import expo.modules.nanort.module.workflows.shared.classification.ClassificationResult
import expo.modules.nanort.module.workflows.shared.classification.ClassificationWorkspace
import expo.modules.nanort.module.workflows.shared.segmentation.Segment
import expo.modules.nanort.module.workflows.shared.segmentation.SegmentationConfig
import expo.modules.nanort.module.workflows.shared.segmentation.SegmentationConfigs
import expo.modules.nanort.module.workflows.shared.segmentation.SegmentationWorkspace
import expo.modules.nanort.module.workflows.shared.segmentation.TensorShapes
import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlinx.coroutines.runBlocking
import org.opencv.android.Utils
import org.opencv.core.CvType
import org.opencv.core.Mat
import org.opencv.core.Scalar
import org.opencv.imgproc.Imgproc
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class WorkflowWorkspaceCompatibilityAndroidTest {

  @get:Rule val rt = NanoRtTestRule(gpuEnabled = false)

  @Test
  fun abstract_classification_pipeline_runs_over_actor_session() {
    runBlocking {
      val pipeline = object : AbstractClassificationPipeline<List<Bitmap>, Int>() {
        override fun getModelId(): ModelId = ModelId.EC
        override fun getConfig(): ClassificationConfig = ClassificationConfigs.External
        override fun getBitmapsToProcess(input: List<Bitmap>): List<Bitmap> = input
        override fun buildOutput(input: List<Bitmap>, result: List<ClassificationResult>): Int = result.size
      }

      val bitmap = Bitmap.createBitmap(224, 224, Bitmap.Config.ARGB_8888)
      bitmap.eraseColor(0xFF6EA84AFF.toInt())

      val count = withTimeoutOrFail(TestTimeouts.LONG_MS) {
        pipeline.execute(listOf(bitmap))
      }

      assertEquals("Classification pipeline should return one result for one bitmap", 1, count)
    }
  }

  @Test
  fun abstract_segmentation_pipeline_runs_without_workspace_aliasing_failures() {
    runBlocking {
      val pipeline = object : AbstractSegmentationPipeline<Bitmap, Int>() {
        override fun getModelId(): ModelId = ModelId.SS
        override fun getConfig(): SegmentationConfig = SegmentationConfigs.SINGLE
        override fun getBitmap(input: Bitmap): Mat = Mat().also { Utils.bitmapToMat(input, it) }
        override fun buildOutput(input: Bitmap, segments: List<Segment>, ws: SegmentationWorkspace): Int {
          return segments.size
        }
      }

      val bitmap = Bitmap.createBitmap(640, 640, Bitmap.Config.ARGB_8888)
      bitmap.eraseColor(0xFF4477AA.toInt())

      val segmentsCount = withTimeoutOrFail(TestTimeouts.LONG_MS) {
        pipeline.execute(bitmap)
      }

      assertTrue("Segmentation output count must be non-negative", segmentsCount >= 0)
    }
  }

  @Test
  fun classification_workspace_is_reused_and_reset_between_calls() {
    runBlocking {
      var ws1: ClassificationWorkspace? = null
      withTimeoutOrFail(TestTimeouts.MEDIUM_MS) {
        WorkspaceManager.useClassificationWorkspace { ws ->
          ws1 = ws
          ws.rgb.create(4, 4, CvType.CV_8UC3)
          ws.rgb.setTo(Scalar(255.0, 255.0, 255.0))
          ws.floatArray = FloatArray(12) { 1f }
        }
      }

      var ws2: ClassificationWorkspace? = null
      var sum = 0.0
      withTimeoutOrFail(TestTimeouts.MEDIUM_MS) {
        WorkspaceManager.useClassificationWorkspace { ws ->
          ws2 = ws
          if (!ws.rgb.empty()) {
            sum = org.opencv.core.Core.sumElems(ws.rgb).`val`.sum()
          }
        }
      }

      assertNotNull(ws1)
      assertNotNull(ws2)
      assertSame("WorkspaceManager must reuse same classification workspace instance", ws1, ws2)
      assertEquals("Classification workspace mats must be reset to zero between calls", 0.0, sum, 0.001)
    }
  }

  @Test
  fun segmentation_postprocess_accepts_readonly_output_buffers_and_reuses_workspace_arrays() {
    runBlocking {
      var wsRef: SegmentationWorkspace? = null
      var firstDet: FloatArray? = null
      var firstProto: FloatArray? = null

      val shapes = TensorShapes(
        maskH = 4,
        maskW = 4,
        maskC = 32,
        detectionLayout = expo.modules.nanort.module.workflows.shared.segmentation.DetectionLayout(
          layoutFeatFirst = false,
          feats = 37,
          dets = 10,
          nCls = 0,
        )
      )

      withTimeoutOrFail(TestTimeouts.MEDIUM_MS) {
        WorkspaceManager.useSegmentationWorkspace { ws ->
          wsRef = ws
          ws.prepareFor(shapes)
          firstDet = ws.detTensor
          firstProto = ws.protoTensor

          val detBuf = ByteBuffer.allocateDirect(ws.detTensor.size * 4).order(ByteOrder.LITTLE_ENDIAN)
          val protoBuf = ByteBuffer.allocateDirect(ws.protoTensor.size * 4).order(ByteOrder.LITTLE_ENDIAN)

          val outputs = mapOf(
            0 to detBuf.asReadOnlyBuffer().order(ByteOrder.LITTLE_ENDIAN),
            1 to protoBuf.asReadOnlyBuffer().order(ByteOrder.LITTLE_ENDIAN),
          )

          val src = Mat(640, 640, CvType.CV_8UC3).also { it.setTo(Scalar(0.0, 0.0, 0.0)) }
          val inputBuffer = ByteBuffer.allocateDirect(640 * 640 * 3 * 4).order(ByteOrder.LITTLE_ENDIAN)
          val meta = expo.modules.nanort.module.workflows.shared.segmentation.SegmentationProcessor.preprocess(src, inputBuffer, ws)
          src.release()

          val out = expo.modules.nanort.module.workflows.shared.segmentation.SegmentationProcessor.postprocess(
            outputs,
            meta,
            shapes,
            ws,
            SegmentationConfigs.SINGLE,
          )

          assertTrue("Expected no detections for zero tensors", out.isEmpty())
        }
      }

      withTimeoutOrFail(TestTimeouts.MEDIUM_MS) {
        WorkspaceManager.useSegmentationWorkspace { ws ->
          ws.prepareFor(shapes)
          assertSame("detTensor should be reused for same shape", firstDet, ws.detTensor)
          assertSame("protoTensor should be reused for same shape", firstProto, ws.protoTensor)
        }
      }

      assertFalse("Segmentation workspace should be available", wsRef == null)
    }
  }
}
