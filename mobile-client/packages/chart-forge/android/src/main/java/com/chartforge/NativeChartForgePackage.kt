package com.chartforge

import android.util.Log
import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

class NativeChartForgePackage : BaseReactPackage() {
  private val moduleName = NativeChartForgeSpec.NAME

  override fun getModule(
    name: String,
    reactContext: ReactApplicationContext,
  ): NativeModule? {
    return if (name == moduleName) {
      NativeChartForgeModule(reactContext)
    } else {
      null
    }
  }

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider {
    return ReactModuleInfoProvider {
      mapOf(
        moduleName to ReactModuleInfo(
          name = moduleName,
          className = NativeChartForgeModule::class.java.name,
          canOverrideExistingModule = false,
          needsEagerInit = false,
          isCxxModule = false,
          isTurboModule = true,
        )
      )
    }
  }

  companion object {
    private const val TAG = "NativeChartForgePackage"
  }
}
