package com.skybolt

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableType
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap

internal object NativeSkyboltConverters {
  fun toKotlinMap(readableMap: ReadableMap): Map<String, Any?> {
    val out = mutableMapOf<String, Any?>()
    val iterator = readableMap.keySetIterator()
    while (iterator.hasNextKey()) {
      val key = iterator.nextKey()
      out[key] = fromDynamic(readableMap, key)
    }
    return out
  }

  fun toKotlinList(readableArray: ReadableArray): List<Any?> {
    val out = mutableListOf<Any?>()
    for (index in 0 until readableArray.size()) {
      out.add(
          when (readableArray.getType(index)) {
            ReadableType.Null -> null
            ReadableType.Boolean -> readableArray.getBoolean(index)
            ReadableType.Number -> readableArray.getDouble(index)
            ReadableType.String -> readableArray.getString(index)
            ReadableType.Map -> readableArray.getMap(index)?.let { toKotlinMap(it) }
            ReadableType.Array -> readableArray.getArray(index)?.let { toKotlinList(it) }
          })
    }
    return out
  }

  fun toWritableMap(input: Map<String, Any?>): WritableMap {
    val writable = Arguments.createMap()
    input.forEach { (key, value) ->
      writeAny(writable, key, value)
    }
    return writable
  }

  fun toWritableArray(input: List<Any?>): WritableArray {
    val writable = Arguments.createArray()
    input.forEach { value ->
      when (value) {
        null -> writable.pushNull()
        is Boolean -> writable.pushBoolean(value)
        is Int -> writable.pushInt(value)
        is Long -> writable.pushDouble(value.toDouble())
        is Float -> writable.pushDouble(value.toDouble())
        is Double -> writable.pushDouble(value)
        is String -> writable.pushString(value)
        is ReadableMap -> writable.pushMap(value)
        is Map<*, *> -> {
          @Suppress("UNCHECKED_CAST")
          writable.pushMap(toWritableMap(value as Map<String, Any?>))
        }
        is ReadableArray -> writable.pushArray(value)
        is List<*> -> writable.pushArray(toWritableArray(value as List<Any?>))
        else -> writable.pushString(value.toString())
      }
    }
    return writable
  }

  private fun fromDynamic(readableMap: ReadableMap, key: String): Any? =
      when (readableMap.getType(key)) {
        ReadableType.Null -> null
        ReadableType.Boolean -> readableMap.getBoolean(key)
        ReadableType.Number -> readableMap.getDouble(key)
        ReadableType.String -> readableMap.getString(key)
        ReadableType.Map -> readableMap.getMap(key)?.let { toKotlinMap(it) }
        ReadableType.Array -> readableMap.getArray(key)?.let { toKotlinList(it) }
      }

  private fun writeAny(target: WritableMap, key: String, value: Any?) {
    when (value) {
      null -> target.putNull(key)
      is Boolean -> target.putBoolean(key, value)
      is Int -> target.putInt(key, value)
      is Long -> target.putDouble(key, value.toDouble())
      is Float -> target.putDouble(key, value.toDouble())
      is Double -> target.putDouble(key, value)
      is String -> target.putString(key, value)
      is ReadableMap -> target.putMap(key, value)
      is Map<*, *> -> {
        @Suppress("UNCHECKED_CAST")
        target.putMap(key, toWritableMap(value as Map<String, Any?>))
      }
      is ReadableArray -> target.putArray(key, value)
      is List<*> -> target.putArray(key, toWritableArray(value as List<Any?>))
      else -> target.putString(key, value.toString())
    }
  }
}
