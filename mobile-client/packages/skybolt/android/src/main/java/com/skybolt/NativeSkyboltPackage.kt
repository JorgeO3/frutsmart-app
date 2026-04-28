package com.skybolt

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

class NativeSkyboltPackage : BaseReactPackage() {
  private val moduleName = NativeSkyboltSpec.NAME

  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
      if (name == moduleName) {
        NativeSkyboltModule(reactContext)
      } else {
        null
      }

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider = ReactModuleInfoProvider {
    mapOf(
        moduleName to
            ReactModuleInfo(
                name = moduleName,
                className = NativeSkyboltModule::class.java.name,
                canOverrideExistingModule = false,
                needsEagerInit = false,
                isCxxModule = false,
                isTurboModule = true))
  }
}
