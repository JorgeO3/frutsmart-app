package expo.modules.nanort.module.workflows

import androidx.test.ext.junit.runners.AndroidJUnit4
import expo.modules.nanort.module.interpreter.testing.NanoRtTestRule
import expo.modules.nanort.module.workflows.shared.segmentation.DetectionLayout
import expo.modules.nanort.module.workflows.shared.segmentation.SegmentationConfigs
import expo.modules.nanort.module.workflows.shared.segmentation.SegmentationProcessor
import expo.modules.nanort.module.workflows.shared.segmentation.SegmentationWorkspace
import expo.modules.nanort.module.workflows.shared.segmentation.TensorShapes
import java.nio.ByteBuffer
import java.nio.ByteOrder
import org.junit.Assert.assertEquals
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.opencv.core.CvType
import org.opencv.core.Mat
import org.opencv.core.Scalar

@RunWith(AndroidJUnit4::class)
class SegmentationProcessorRegressionAndroidTest {

  @get:Rule val rt = NanoRtTestRule(gpuEnabled = false)

  @Test
  fun preprocess_should_fill_expected_tensor_and_postprocess_should_accept_readonly_buffers() {
    val ws = SegmentationWorkspace()
    try {
      val src = Mat(640, 640, CvType.CV_8UC3).also { it.setTo(Scalar(20.0, 90.0, 180.0)) }
      val inputBuffer = ByteBuffer.allocateDirect(640 * 640 * 3 * 4).order(ByteOrder.LITTLE_ENDIAN)

      val meta = SegmentationProcessor.preprocess(src, inputBuffer, ws)
      src.release()

      val fb = inputBuffer.asFloatBuffer()
      val sample = FloatArray(32)
      fb.get(sample)
      assertTrue("Preprocess must produce finite values", sample.all { it.isFinite() })
      assertTrue("Preprocess values should stay in [0,1]", sample.all { it in 0.0f..1.0f })
      assertEquals(640, meta.origH)
      assertEquals(640, meta.origW)

      val shapes = TensorShapes(
        maskH = 4,
        maskW = 4,
        maskC = 32,
        detectionLayout = DetectionLayout(
          layoutFeatFirst = false,
          feats = 37,
          dets = 10,
          nCls = 0,
        )
      )

      ws.prepareFor(shapes)
      val detFirst = ws.detTensor
      val protoFirst = ws.protoTensor

      val detBuf = ByteBuffer.allocateDirect(ws.detTensor.size * 4).order(ByteOrder.LITTLE_ENDIAN)
      val protoBuf = ByteBuffer.allocateDirect(ws.protoTensor.size * 4).order(ByteOrder.LITTLE_ENDIAN)

      val outputs = mapOf(
        0 to detBuf.asReadOnlyBuffer().order(ByteOrder.LITTLE_ENDIAN),
        1 to protoBuf.asReadOnlyBuffer().order(ByteOrder.LITTLE_ENDIAN),
      )

      val segments = SegmentationProcessor.postprocess(
        outputs,
        meta,
        shapes,
        ws,
        SegmentationConfigs.SINGLE,
      )

      assertTrue("Expected no detections for zero tensors", segments.isEmpty())

      ws.prepareFor(shapes)
      assertSame("detTensor should be reused for same shape", detFirst, ws.detTensor)
      assertSame("protoTensor should be reused for same shape", protoFirst, ws.protoTensor)
    } finally {
      ws.close()
    }
  }
}
