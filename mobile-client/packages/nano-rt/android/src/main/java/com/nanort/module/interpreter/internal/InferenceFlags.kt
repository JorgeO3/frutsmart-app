package com.nanort.module.interpreter.internal

internal object InferenceFlags {
  @Volatile var gpuEnabled: Boolean = true
  @Volatile var gpuSerializationEnabled: Boolean = true
}
