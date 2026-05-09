package com.nanort.core.startup

import android.content.Context

object BootstrapReadinessGate {
    private const val PREFS_NAME = "frutsmart_startup_gate"
    private const val KEY_NANORT_READY = "nanort_ready"

    fun markNanoRtReady(context: Context, ready: Boolean) {
        context
            .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putBoolean(KEY_NANORT_READY, ready)
            .apply()
    }
}
