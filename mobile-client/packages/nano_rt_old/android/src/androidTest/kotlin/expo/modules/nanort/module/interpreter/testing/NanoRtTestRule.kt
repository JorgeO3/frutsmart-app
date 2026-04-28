package expo.modules.nanort.module.interpreter.testing

import android.app.Application
import android.content.Context
import androidx.test.platform.app.InstrumentationRegistry
import expo.modules.nanort.BuildConfig
import expo.modules.nanort.core.AppAssets
import expo.modules.nanort.core.ModuleLogger
import expo.modules.nanort.module.interpreter.ModelManager
import expo.modules.nanort.module.interpreter.internal.InferenceFlags
import org.opencv.android.OpenCVLoader
import org.junit.rules.ExternalResource

class NanoRtTestRule(
  private val gpuEnabled: Boolean = false,
) : ExternalResource() {

  lateinit var context: Context
    private set

  lateinit var harness: NanoRtHarness
    private set

  private var prevGpuEnabled: Boolean = true

  override fun before() {
    context = InstrumentationRegistry.getInstrumentation().targetContext
    val app = context.applicationContext as Application

    AppAssets.init(app)
    ModuleLogger.init(application = app, isDebug = BuildConfig.DEBUG, prefix = "NanoRT")

    check(OpenCVLoader.initLocal()) { "OpenCV initLocal failed in test rule" }

    prevGpuEnabled = InferenceFlags.gpuEnabled

    DebugControls.clearAll()
    ModelManager.clearActorForTests()

    InferenceFlags.gpuEnabled = gpuEnabled

    harness = NanoRtHarness.real(context)
    harness.installIfNeeded()
  }

  override fun after() {
    runCatching { harness.close() }
    InferenceFlags.gpuEnabled = prevGpuEnabled
    DebugControls.clearAll()
  }
}
