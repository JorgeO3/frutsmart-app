package expo.modules.nanort.module.workflows

import android.graphics.Bitmap
import androidx.test.ext.junit.runners.AndroidJUnit4
import expo.modules.nanort.module.interpreter.testing.NanoRtTestRule
import expo.modules.nanort.module.workflows.shared.classification.ClassificationProcessor
import expo.modules.nanort.module.workflows.shared.classification.ClassificationWorkspace
import java.nio.ByteBuffer
import java.nio.ByteOrder
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class ClassificationProcessorRegressionAndroidTest {

  @get:Rule val rt = NanoRtTestRule(gpuEnabled = false)

  @Test
  fun preprocess_should_fill_input_tensor_in_expected_range_and_reuse_workspace_array() {
    val size = 224
    val expectedFloats = size * size * 3
    val ws = ClassificationWorkspace()

    try {
      val bitmapA = Bitmap.createBitmap(300, 200, Bitmap.Config.ARGB_8888).also {
        it.eraseColor(0xFF3A9B4E.toInt())
      }
      val bitmapB = Bitmap.createBitmap(300, 200, Bitmap.Config.ARGB_8888).also {
        it.eraseColor(0xFFA65B2F.toInt())
      }

      val inputBuffer = ByteBuffer.allocateDirect(expectedFloats * 4).order(ByteOrder.LITTLE_ENDIAN)

      ClassificationProcessor.preprocess(bitmapA, inputBuffer, ws, size)
      val firstArray = ws.floatArray
      assertTrue("Workspace float array should be initialized", firstArray != null)

      val firstValues = FloatArray(expectedFloats)
      inputBuffer.asFloatBuffer().get(firstValues)
      assertTrue("All tensor values must be finite", firstValues.all { it.isFinite() })
      assertTrue("Tensor values must stay in [0,1]", firstValues.all { it in 0.0f..1.0f })
      assertTrue(
        "Expected non-zero normalized content for non-black bitmap",
        firstValues.any { it > 0.01f }
      )

      ClassificationProcessor.preprocess(bitmapB, inputBuffer, ws, size)
      val secondArray = ws.floatArray
      assertSame("Workspace float array should be reused across calls", firstArray, secondArray)

      val secondValues = FloatArray(expectedFloats)
      inputBuffer.asFloatBuffer().get(secondValues)
      assertTrue("All tensor values must be finite", secondValues.all { it.isFinite() })
      assertTrue("Tensor values must stay in [0,1]", secondValues.all { it in 0.0f..1.0f })

      bitmapA.recycle()
      bitmapB.recycle()
    } finally {
      ws.close()
    }
  }

  @Test(expected = IllegalArgumentException::class)
  fun preprocess_should_reject_mismatched_input_buffer_capacity() {
    val size = 224
    val ws = ClassificationWorkspace()
    try {
      val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
      val wrongBuffer = ByteBuffer.allocateDirect(32).order(ByteOrder.LITTLE_ENDIAN)
      ClassificationProcessor.preprocess(bitmap, wrongBuffer, ws, size)
    } finally {
      ws.close()
    }
  }
}
