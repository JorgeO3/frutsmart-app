package expo.modules.nanort.module.workflows

import android.graphics.Bitmap
import androidx.test.ext.junit.runners.AndroidJUnit4
import expo.modules.nanort.module.interpreter.ModelId
import expo.modules.nanort.module.interpreter.WorkspaceManager
import expo.modules.nanort.module.interpreter.testing.NanoRtTestRule
import expo.modules.nanort.module.interpreter.testing.TestTimeouts
import expo.modules.nanort.module.interpreter.testing.withTimeoutOrFail
import expo.modules.nanort.module.workflows.shared.base.AbstractClassificationPipeline
import expo.modules.nanort.module.workflows.shared.classification.ClassificationConfig
import expo.modules.nanort.module.workflows.shared.classification.ClassificationConfigs
import expo.modules.nanort.module.workflows.shared.classification.ClassificationResult
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class ClassificationWorkspaceAliasingAndroidTest {

  @get:Rule val rt = NanoRtTestRule(gpuEnabled = false)

  @Test
  fun workspace_reuse_and_external_result_mutation_must_not_corrupt_next_run() {
    runBlocking {
      val pipeline = object : AbstractClassificationPipeline<List<Bitmap>, List<ClassificationResult>>() {
        override fun getModelId(): ModelId = ModelId.EC
        override fun getConfig(): ClassificationConfig = ClassificationConfigs.External
        override fun getBitmapsToProcess(input: List<Bitmap>): List<Bitmap> = input
        override fun buildOutput(
          input: List<Bitmap>,
          result: List<ClassificationResult>
        ): List<ClassificationResult> = result
      }

      var ws1: Any? = null
      withTimeoutOrFail(TestTimeouts.MEDIUM_MS) {
        WorkspaceManager.useClassificationWorkspace { ws ->
          ws1 = ws
        }
      }

      val bitmap = Bitmap.createBitmap(224, 224, Bitmap.Config.ARGB_8888).also {
        it.eraseColor(0xFF77A652.toInt())
      }

      val first = withTimeoutOrFail(TestTimeouts.LONG_MS) { pipeline.execute(listOf(bitmap)) }
      assertEquals(1, first.size)
      assertTrue("Expected confidences in first run", first[0].confidences.isNotEmpty())

      first[0].confidences.fill(0f)

      val second = withTimeoutOrFail(TestTimeouts.LONG_MS) { pipeline.execute(listOf(bitmap)) }
      assertEquals(1, second.size)
      assertTrue("Expected confidences in second run", second[0].confidences.isNotEmpty())
      assertTrue("Second run must return a fresh confidences array", second[0].confidences !== first[0].confidences)

      var ws2: Any? = null
      withTimeoutOrFail(TestTimeouts.MEDIUM_MS) {
        WorkspaceManager.useClassificationWorkspace { ws ->
          ws2 = ws
        }
      }

      assertNotNull(ws1)
      assertNotNull(ws2)
      assertSame("Classification workspace instance should be reused", ws1, ws2)

      bitmap.recycle()
    }
  }
}
