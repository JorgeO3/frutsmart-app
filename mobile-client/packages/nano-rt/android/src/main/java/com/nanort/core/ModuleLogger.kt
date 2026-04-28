package com.nanort.core

import android.app.Application
import android.content.pm.ApplicationInfo
import android.util.Log

/**
 * High-performance configurable logger for Android modules.
 *
 * Features:
 * - Debug/Release detection (via Application.flags o isDebug explícito)
 * - Configurable minLevel y habilitado
 * - Lazy message evaluation
 * - Opción de respetar Log.isLoggable (off por defecto)
 * - Tag prefix con truncamiento seguro
 *
 * @author PixelForge
 * @version 1.1
 */
object ModuleLogger {

    object LogLevel {
        const val VERBOSE = Log.VERBOSE // 2
        const val DEBUG = Log.DEBUG     // 3
        const val INFO = Log.INFO       // 4
        const val WARN = Log.WARN       // 5
        const val ERROR = Log.ERROR     // 6
        const val NONE = 99             // Desactiva todo
    }

    private const val MAX_TAG_LEN = 23

    @Volatile private var _enabled: Boolean = true
    @Volatile private var _minLevel: Int = LogLevel.VERBOSE
    @Volatile private var _tagPrefix: String = "Module"
    /**
     * Si es true, además de minLevel se aplicará Log.isLoggable(tag, level).
     * Por defecto false para no depender de propiedades del sistema.
     */
    @Volatile private var _honorSystemProperties: Boolean = false

    val enabled: Boolean get() = _enabled
    val minLevel: Int get() = _minLevel
    val tagPrefix: String get() = _tagPrefix
    val honorSystemProperties: Boolean get() = _honorSystemProperties

    /**
     * Inicializa detectando debug/release.
     *
     * @param application opcional para inferir FLAG_DEBUGGABLE
     * @param isDebug opcional para forzar (p.ej., BuildConfig.DEBUG del app)
     * @param enabledOverride opcional para forzar enabled
     * @param minLevelOverride opcional para forzar nivel mínimo
     * @param prefix opcional para cambiar prefijo de tag
     * @param honorSystemProperties si true, aplicará Log.isLoggable(tag, level)
     */
    @Synchronized
    fun init(
        application: Application? = null,
        isDebug: Boolean? = null,
        enabledOverride: Boolean? = null,
        minLevelOverride: Int? = null,
        prefix: String? = null,
        honorSystemProperties: Boolean? = null
    ) {
        val debuggable = isDebug ?: application?.let {
            (it.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0
        } ?: false

        val defaultMin = if (debuggable) LogLevel.DEBUG else LogLevel.ERROR

        _enabled = enabledOverride ?: true
        _minLevel = minLevelOverride ?: defaultMin
        prefix?.let { _tagPrefix = it }
        honorSystemProperties?.let { _honorSystemProperties = it }

        if (_enabled && _minLevel <= LogLevel.INFO) {
            Log.i(
                createTag("Config"),
                "Logger configured: enabled=${_enabled}, minLevel=${_minLevel}, " +
                    "prefix=${_tagPrefix}, honorSystemProps=${_honorSystemProperties}"
            )
        }
    }

    /**
     * Reconfiguración rápida (mantiene la política de isLoggable actual).
     */
    @Synchronized
    fun configure(
        enabled: Boolean,
        minLevel: Int,
        prefix: String? = null,
        honorSystemProperties: Boolean? = null
    ) {
        _enabled = enabled
        _minLevel = minLevel
        prefix?.let { _tagPrefix = it }
        honorSystemProperties?.let { _honorSystemProperties = it }

        if (_enabled && _minLevel <= LogLevel.INFO) {
            Log.i(
                createTag("Config"),
                "Logger configured: enabled=${_enabled}, minLevel=${_minLevel}, " +
                    "prefix=${_tagPrefix}, honorSystemProps=${_honorSystemProperties}"
            )
        }
    }

    fun createTag(component: String): String = safeTag("$_tagPrefix-$component")

    private fun safeTag(tag: String): String =
        if (tag.length <= MAX_TAG_LEN) tag else tag.take(MAX_TAG_LEN)

    fun disable() {
        configure(enabled = false, minLevel = LogLevel.NONE)
    }

    fun enable() {
        configure(enabled = true, minLevel = LogLevel.DEBUG)
    }

    fun isLoggable(logLevel: Int, tag: String): Boolean {
        if (!_enabled || _minLevel > logLevel) return false
        if (_honorSystemProperties) {
            // Solo aplica isLoggable si el usuario lo pide.
            return Log.isLoggable(tag, logLevel)
        }
        return true
    }
}

/**
 * Helper externo por compatibilidad con tu API previa.
 */
inline fun shouldLog(level: Int, tag: String): Boolean {
    return ModuleLogger.isLoggable(level, tag)
}

// =============================================================================
// OPTIMIZED LOGGING FUNCTIONS (lazy)
// =============================================================================

inline fun logV(tag: String, message: () -> String) {
    if (shouldLog(Log.VERBOSE, tag)) Log.v(tag, message())
}

inline fun logD(tag: String, message: () -> String) {
    if (shouldLog(Log.DEBUG, tag)) Log.d(tag, message())
}

inline fun logI(tag: String, message: () -> String) {
    if (shouldLog(Log.INFO, tag)) Log.i(tag, message())
}

inline fun logW(tag: String, message: () -> String) {
    if (shouldLog(Log.WARN, tag)) Log.w(tag, message())
}

inline fun logW(tag: String, throwable: Throwable, message: () -> String) {
    if (shouldLog(Log.WARN, tag)) Log.w(tag, message(), throwable)
}

inline fun logE(tag: String, message: () -> String) {
    if (shouldLog(Log.ERROR, tag)) Log.e(tag, message())
}

inline fun logE(tag: String, throwable: Throwable, message: () -> String) {
    if (shouldLog(Log.ERROR, tag)) Log.e(tag, message(), throwable)
}

// =============================================================================
// CONVENIENCE (auto-tag por clase)
// =============================================================================

inline fun <reified T> T.logD(noinline message: () -> String) {
    logD(ModuleLogger.createTag(T::class.java.simpleName), message)
}

inline fun <reified T> T.logI(noinline message: () -> String) {
    logI(ModuleLogger.createTag(T::class.java.simpleName), message)
}

inline fun <reified T> T.logE(noinline message: () -> String) {
    logE(ModuleLogger.createTag(T::class.java.simpleName), message)
}

inline fun <reified T> T.logE(throwable: Throwable, noinline message: () -> String) {
    logE(ModuleLogger.createTag(T::class.java.simpleName), throwable, message)
}
