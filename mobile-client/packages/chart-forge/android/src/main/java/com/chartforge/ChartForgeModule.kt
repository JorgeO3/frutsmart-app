package com.chartforge

import com.facebook.react.bridge.ReactApplicationContext

class ChartForgeModule(reactContext: ReactApplicationContext) :
  NativeChartForgeSpec(reactContext) {

  override fun multiply(a: Double, b: Double): Double {
    return a * b
  }

  companion object {
    const val NAME = NativeChartForgeSpec.NAME
  }
}
