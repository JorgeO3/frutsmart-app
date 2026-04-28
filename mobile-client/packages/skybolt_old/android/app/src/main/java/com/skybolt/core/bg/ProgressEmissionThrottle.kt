package com.skybolt.core.bg

internal class ProgressEmissionThrottle(
    private val fgIntervalMs: Long,
    private val jsIntervalMs: Long,
) {
    private var lastFgUpdateMs: Long? = null
    private var lastJsUpdateMs: Long? = null

    fun shouldEmitForeground(nowMs: Long): Boolean {
        val last = lastFgUpdateMs
        if (last == null || nowMs - last >= fgIntervalMs) {
            lastFgUpdateMs = nowMs
            return true
        }
        return false
    }

    fun shouldEmitJs(nowMs: Long): Boolean {
        val last = lastJsUpdateMs
        if (last == null || nowMs - last >= jsIntervalMs) {
            lastJsUpdateMs = nowMs
            return true
        }
        return false
    }
}
