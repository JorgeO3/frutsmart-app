@file:Suppress(
    "NOTHING_TO_INLINE",
    "UNUSED_PARAMETER",
    "FunctionName"
)

package expo.modules.skybolt.core.util

import android.app.Application
import android.content.pm.ApplicationInfo
import android.util.Log
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicLong
import java.util.concurrent.atomic.AtomicReference
import kotlin.contracts.ExperimentalContracts
import kotlin.contracts.InvocationKind
import kotlin.contracts.contract
import kotlin.properties.ReadOnlyProperty
import kotlin.reflect.KProperty
import kotlin.time.TimeSource


/* =========================== Niveles y Tag tipados =========================== */

enum class LogLevel(val priority: Int) {
    VERBOSE(Log.VERBOSE),
    DEBUG(Log.DEBUG),
    INFO(Log.INFO),
    WARN(Log.WARN),
    ERROR(Log.ERROR),
    ASSERT(Log.ASSERT)
}

@JvmInline
value class LogTag(val value: String)

/* =============================== Sinks (salidas) ============================== */

interface LogSink {
    fun log(level: LogLevel, tag: String, message: String, throwable: Throwable?)
}

object AndroidLogSink : LogSink {
    override fun log(level: LogLevel, tag: String, message: String, throwable: Throwable?) {
        when (level) {
            LogLevel.VERBOSE -> if (throwable == null) Log.v(tag, message) else Log.v(tag, message, throwable)
            LogLevel.DEBUG   -> if (throwable == null) Log.d(tag, message) else Log.d(tag, message, throwable)
            LogLevel.INFO    -> if (throwable == null) Log.i(tag, message) else Log.i(tag, message, throwable)
            LogLevel.WARN    -> if (throwable == null) Log.w(tag, message) else Log.w(tag, message, throwable)
            LogLevel.ERROR   -> if (throwable == null) Log.e(tag, message) else Log.e(tag, message, throwable)
            LogLevel.ASSERT  -> Log.wtf(tag, message, throwable)
        }
    }
}

/* ============================== Núcleo AppLogger ============================== */

object AppLogger {

    // Estado thread-safe.
    private val _enabled = AtomicBoolean(true)
    private val _minLevel = AtomicInteger(Log.VERBOSE)
    private val _tagPrefix = AtomicReference("")
    private val _honorSystemProperties = AtomicBoolean(false)

    // Sinks enchufables.
    private val sinksRef = AtomicReference<List<LogSink>>(listOf(AndroidLogSink))

    /* ------------------------------ Getters públicos ------------------------------ */
    val enabled: Boolean get() = _enabled.get()
    val minLevel: LogLevel
        get() = LogLevel.entries.first { it.priority == _minLevel.get() }
    val prefix: String get() = _tagPrefix.get()
    val honorSystemProperties: Boolean get() = _honorSystemProperties.get()
    val sinks: List<LogSink> get() = sinksRef.get()

    /* --------------------------------- Mutadores --------------------------------- */
    fun addSink(sink: LogSink) { sinksRef.getAndUpdate { it + sink } }
    fun removeSink(sink: LogSink) { sinksRef.getAndUpdate { it - sink } }

    /** Visible para inline. */
    @PublishedApi
    internal fun dispatch(level: LogLevel, tag: String, msg: String, t: Throwable?) {
        sinksRef.get().forEach { it.log(level, tag, msg, t) }
    }

    /* --------------------------------- Utilidad ---------------------------------- */
    private fun isDebuggable(app: Application?): Boolean =
        app?.let { (it.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0 } ?: false

    fun init(
        application: Application? = null,
        isDebug: Boolean? = null,
        enabled: Boolean? = null,
        minLevel: LogLevel? = null,
        prefix: String? = null,
        honorSystemProperties: Boolean? = null
    ) {
        val debuggable = isDebug ?: isDebuggable(application)

        _enabled.set(enabled ?: true)
        _minLevel.set((minLevel ?: if (debuggable) LogLevel.DEBUG else LogLevel.ERROR).priority)
        _tagPrefix.set(prefix ?: "")
        _honorSystemProperties.set(honorSystemProperties ?: false)

        val t = formatTag("Init")
        if (canLog(t, LogLevel.INFO)) {
            Log.i(t, buildConfigMessage())
        }
    }

    fun configure(
        enabled: Boolean? = null,
        minLevel: LogLevel? = null,
        prefix: String? = null,
        honorSystemProperties: Boolean? = null
    ) {
        enabled?.let { _enabled.set(it) }
        minLevel?.let { _minLevel.set(it.priority) }
        prefix?.let { _tagPrefix.set(it) }
        honorSystemProperties?.let { _honorSystemProperties.set(it) }

        val t = formatTag("Config")
        if (canLog(t, LogLevel.INFO)) {
            Log.i(t, buildConfigMessage())
        }
    }

    fun disable() = configure(enabled = false, minLevel = LogLevel.ASSERT)
    fun enable(min: LogLevel = LogLevel.DEBUG) = configure(enabled = true, minLevel = min)

    /** Orden tag, level para complacer Lint y evitar "mismatched tags". */
    fun canLog(tag: String, level: LogLevel): Boolean {
        if (!_enabled.get() || level.priority < _minLevel.get()) return false
        return if (_honorSystemProperties.get()) Log.isLoggable(tag, level.priority) else true
    }

    /** En < 24 limitamos a 23 chars; si tu minSdk ≥ 24, no se trunca. */
    fun formatTag(component: String): String {
        val base = _tagPrefix.get().takeIf { it.isNotEmpty() }?.let { "$it-$component" } ?: component
        return if (base.length > 23) base.take(23) else base
    }

    private fun buildConfigMessage(): String =
        "enabled=${_enabled.get()}, minLevel=${_minLevel.get()}, prefix=${_tagPrefix.get()}, honorSystemProperties=${_honorSystemProperties.get()}"

    /* ----------------------------- Configuración scoped ----------------------------- */
    inline fun <R> scoped(
        enabled: Boolean? = null,
        minLevel: LogLevel? = null,
        prefix: String? = null,
        honorSystemProperties: Boolean? = null,
        block: () -> R
    ): R {
        // Snapshot real
        val snapEnabled = this.enabled
        val snapMin = this.minLevel
        val snapPrefix = this.prefix
        val snapHonor = this.honorSystemProperties
        try {
            configure(enabled, minLevel, prefix, honorSystemProperties)
            return block()
        } finally {
            configure(snapEnabled, snapMin, snapPrefix, snapHonor)
        }
    }
}

/* ============================= API unificada de log ============================= */

@OptIn(ExperimentalContracts::class)
inline fun log(
    level: LogLevel,
    tag: String,
    throwable: Throwable? = null,
    message: () -> String
) {
    contract { callsInPlace(message, InvocationKind.AT_MOST_ONCE) }
    val realTag = AppLogger.formatTag(tag)
    if (!AppLogger.canLog(realTag, level)) return
    val msg = message()
    AppLogger.dispatch(level, realTag, msg, throwable)
}

/* --------------------------------- Helpers --------------------------------- */

inline fun v(tag: String, noinline message: () -> String) = log(LogLevel.VERBOSE, tag, null, message)
inline fun d(tag: String, noinline message: () -> String) = log(LogLevel.DEBUG,   tag, null, message)
inline fun i(tag: String, noinline message: () -> String) = log(LogLevel.INFO,    tag, null, message)
inline fun w(tag: String, noinline message: () -> String) = log(LogLevel.WARN,    tag, null, message)
inline fun e(tag: String, noinline message: () -> String) = log(LogLevel.ERROR,   tag, null, message)

inline fun w(tag: String, throwable: Throwable, noinline message: () -> String) =
    log(LogLevel.WARN, tag, throwable, message)
inline fun e(tag: String, throwable: Throwable, noinline message: () -> String) =
    log(LogLevel.ERROR, tag, throwable, message)

/* =============== DSL de campos/estructura (sin ambigüedad de overloads) =============== */

class LogEventBuilder {
    var msg: String = ""
    private val fields = linkedMapOf<String, Any?>()

    infix fun String.to(value: Any?) { fields[this] = value }

    fun build(): String {
        val kv = if (fields.isEmpty()) "" else fields.entries.joinToString(" ") { (k, v) -> "$k=${v ?: "null"}" }
        return when {
            msg.isEmpty() -> kv
            kv.isEmpty()  -> msg
            else          -> "$msg | $kv"
        }
    }
}

/** Builder con nombre distinto para evitar colisión con i(msg). */
inline fun iFields(tag: String, build: LogEventBuilder.() -> Unit) {
    val b = LogEventBuilder().apply(build)
    i(tag) { b.build() }
}

inline fun dFields(tag: String, build: LogEventBuilder.() -> Unit) {
    val b = LogEventBuilder().apply(build)
    d(tag) { b.build() }
}

/* ========================== Property delegate por clase ========================== */

class TaggedLogger internal constructor(val tag: String) {
    inline fun v(noinline m: () -> String) = log(LogLevel.VERBOSE, tag, null, m)
    inline fun d(noinline m: () -> String) = log(LogLevel.DEBUG,   tag, null, m)
    inline fun i(noinline m: () -> String) = log(LogLevel.INFO,    tag, null, m)
    inline fun w(noinline m: () -> String) = log(LogLevel.WARN,    tag, null, m)
    inline fun e(noinline m: () -> String) = log(LogLevel.ERROR,   tag, null, m)

    inline fun w(t: Throwable, noinline m: () -> String) = log(LogLevel.WARN,  tag, t, m)
    inline fun e(t: Throwable, noinline m: () -> String) = log(LogLevel.ERROR, tag, t, m)

    // Campos
    inline fun iFields(build: LogEventBuilder.() -> Unit) = iFields(tag, build)
    inline fun dFields(build: LogEventBuilder.() -> Unit) = dFields(tag, build)

    // Duración y trace
    inline fun <T> duration(level: LogLevel = LogLevel.DEBUG, label: String = "duration", block: () -> T): T {
        val mark = TimeSource.Monotonic.markNow()
        try { return block() } finally { log(level, tag) { "$label=${mark.elapsedNow()}" } }
    }

    inline fun <T> trace(name: String = "trace", block: () -> T): T {
        i { "$name:start" }
        val mark = TimeSource.Monotonic.markNow()
        return try {
            val r = block()
            i { "$name:end | duration=${mark.elapsedNow()}" }
            r
        } catch (t: Throwable) {
            e(t) { "$name:error | duration=${mark.elapsedNow()}" }
            throw t
        }
    }

    inline fun iEvery(every: Int, key: String, noinline m: () -> String) {
        if (Sampler.shouldLog("$tag|I|$key", every)) i(m)
    }
}

fun logger(name: String? = null): ReadOnlyProperty<Any?, TaggedLogger> =
    object : ReadOnlyProperty<Any?, TaggedLogger> {
        private var cached: TaggedLogger? = null
        override fun getValue(thisRef: Any?, property: KProperty<*>): TaggedLogger {
            return cached ?: run {
                val raw = name ?: (thisRef?.javaClass?.simpleName ?: property.name)
                val t = AppLogger.formatTag(raw)
                TaggedLogger(t).also { cached = it }
            }
        }
    }

/* ================================ Utilidades extra =============================== */

inline fun debugOnly(block: () -> Unit) {
    val t = AppLogger.formatTag("Debug")
    if (AppLogger.canLog(t, LogLevel.DEBUG)) block()
}

inline fun <T> logDuration(
    tag: String,
    level: LogLevel = LogLevel.DEBUG,
    label: String = "duration",
    block: () -> T
): T {
    val mark = TimeSource.Monotonic.markNow()
    try { return block() } finally { log(level, tag) { "$label=${mark.elapsedNow()}" } }
}

inline fun <reified T> autoTag(): String = AppLogger.formatTag(T::class.java.simpleName)

/* ------------------------------ Sampler / Rate limit ------------------------------ */

/** Visible para inline. */
@PublishedApi
internal object Sampler {
    private val map = ConcurrentHashMap<String, AtomicLong>()
    fun shouldLog(key: String, every: Int): Boolean {
        val c = map.computeIfAbsent(key) { AtomicLong(0) }.incrementAndGet()
        return c % every.toLong() == 0L
    }
}

/* ================================ Alias legacy ================================== */

// Para que no te rompa nada si ya usabas mayúsculas.
@Deprecated("Usa d()", ReplaceWith("this.d(message)"))
inline fun TaggedLogger.D(noinline message: () -> String) = d(message)
@Deprecated("Usa i()", ReplaceWith("this.i(message)"))
inline fun TaggedLogger.I(noinline message: () -> String) = i(message)
@Deprecated("Usa w()", ReplaceWith("this.w(message)"))
inline fun TaggedLogger.W(noinline message: () -> String) = w(message)
@Deprecated("Usa e()", ReplaceWith("this.e(message)"))
inline fun TaggedLogger.E(noinline message: () -> String) = e(message)
@Deprecated("Usa e(t){ }", ReplaceWith("this.e(t, message)"))
inline fun TaggedLogger.E(t: Throwable, noinline message: () -> String) = e(t, message)
