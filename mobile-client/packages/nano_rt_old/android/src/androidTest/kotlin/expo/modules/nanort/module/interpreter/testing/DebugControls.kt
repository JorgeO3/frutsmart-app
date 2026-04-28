package expo.modules.nanort.module.interpreter.testing

import expo.modules.nanort.module.interpreter.internal.InferenceFlags
import expo.modules.nanort.module.interpreter.internal.ModelManagerDebugHooks

object DebugControls {
  fun clearAll() {
    ModelManagerDebugHooks.clear()
  }

  fun forceGpuDisabled(disabled: Boolean) {
    InferenceFlags.gpuEnabled = !disabled
  }
}
