package com.nanort

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

class NativeNanoRTPackage : BaseReactPackage() {
  private val moduleName = NativeNanoRTSpec.NAME

  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
    if (name == moduleName) {
      NativeNanoRTModule(reactContext)
    } else {
      null
    }

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider = ReactModuleInfoProvider {
    mapOf(
      moduleName to ReactModuleInfo(
        name = moduleName,
        className = NativeNanoRTModule::class.java.name,
        canOverrideExistingModule = false,
        needsEagerInit = false,
        isCxxModule = false,
        isTurboModule = true,
      )
    )
  }
}
