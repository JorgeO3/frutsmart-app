package com.skybolt.core.startup

import android.app.ActivityManager
import android.content.Context
import android.os.SystemClock

object StartupGate {
    private const val PREFS_NAME = "frutsmart_startup_gate"
    private const val KEY_PROCESS_STARTED_AT = "process_started_at_elapsed_ms"
    private const val KEY_NANORT_READY = "nanort_ready"

    fun markProcessStarted(context: Context) {
        context
            .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putLong(KEY_PROCESS_STARTED_AT, SystemClock.elapsedRealtime())
            .putBoolean(KEY_NANORT_READY, false)
            .apply()
    }

    fun isNanoRtReady(context: Context): Boolean {
        return context
            .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getBoolean(KEY_NANORT_READY, false)
    }

    fun millisSinceProcessStart(context: Context): Long {
        val startedAt = context
            .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getLong(KEY_PROCESS_STARTED_AT, -1L)

        if (startedAt <= 0L) return Long.MAX_VALUE
        return SystemClock.elapsedRealtime() - startedAt
    }

    fun shouldDeferForegroundStartupWork(context: Context): Boolean {
        return isAppForeground(context) && !isNanoRtReady(context)
    }

    private fun isAppForeground(context: Context): Boolean {
        val activityManager =
            context.getSystemService(Context.ACTIVITY_SERVICE) as? ActivityManager
                ?: return false

        val process = activityManager.runningAppProcesses
            ?.firstOrNull { it.processName == context.packageName }
            ?: return false

        return process.importance == ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND ||
            process.importance == ActivityManager.RunningAppProcessInfo.IMPORTANCE_VISIBLE
    }
}
