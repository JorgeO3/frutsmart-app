package expo.modules.nanort.module.workflows

import android.graphics.Bitmap
import androidx.test.ext.junit.runners.AndroidJUnit4
import expo.modules.nanort.module.interpreter.ModelId
import expo.modules.nanort.module.interpreter.testing.NanoRtTestRule
import expo.modules.nanort.module.interpreter.testing.TestTimeouts
import expo.modules.nanort.module.interpreter.testing.withTimeoutOrFail
import expo.modules.nanort.module.workflows.shared.base.AbstractClassificationPipeline
import expo.modules.nanort.module.workflows.shared.classification.ClassificationConfig
import expo.modules.nanort.module.workflows.shared.classification.ClassificationConfigs
import expo.modules.nanort.module.workflows.shared.classification.ClassificationResult
import java.util.Arrays
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class WorkflowOutputSnapshotAndroidTest {

  @get:Rule val rt = NanoRtTestRule(gpuEnabled = false)

  @Test
  fun classification_outputs_must_be_stable_after_later_workflow_runs() {
    runBlocking {
      val pipeline = object : AbstractClassificationPipeline<List<Bitmap>, List<FloatArray>>() {
        override fun getModelId(): ModelId = ModelId.IC
        override fun getConfig(): ClassificationConfig = ClassificationConfigs.Internal
        override fun getBitmapsToProcess(input: List<Bitmap>): List<Bitmap> = input
        override fun buildOutput(input: List<Bitmap>, result: List<ClassificationResult>): List<FloatArray> =
          result.map { it.confidences }
      }

      val bitmapA = Bitmap.createBitmap(224, 224, Bitmap.Config.ARGB_8888).also {
        it.eraseColor(0xFF4E8F63.toInt())
      }
      val bitmapB = Bitmap.createBitmap(224, 224, Bitmap.Config.ARGB_8888).also {
        it.eraseColor(0xFFAA5A3A.toInt())
      }

      val first = withTimeoutOrFail(TestTimeouts.LONG_MS) { pipeline.execute(listOf(bitmapA)) }
      assertEquals(1, first.size)
      val escaped = first[0]
      val before = escaped.copyOf()

      withTimeoutOrFail(TestTimeouts.LONG_MS) { pipeline.execute(listOf(bitmapB)) }

      assertTrue(
        "First workflow output was mutated after later run (snapshot/alias violation)",
        Arrays.equals(before, escaped)
      )

      bitmapA.recycle()
      bitmapB.recycle()
    }
  }
}
