package expo.modules.skybolt.core.bg

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ProgressEmissionThrottleTest {

    @Test
    fun jsThrottle_limitsBurstEvents() {
        val throttle = ProgressEmissionThrottle(
            fgIntervalMs = 1000L,
            jsIntervalMs = 300L,
        )

        var emitted = 0
        for (t in 0L..1000L step 10L) {
            if (throttle.shouldEmitJs(t)) emitted++
        }

        assertTrue(emitted <= 4)
        assertTrue(emitted >= 3)
    }

    @Test
    fun fgThrottle_limitsBurstEvents() {
        val throttle = ProgressEmissionThrottle(
            fgIntervalMs = 1000L,
            jsIntervalMs = 300L,
        )

        var emitted = 0
        for (t in 0L..3000L step 50L) {
            if (throttle.shouldEmitForeground(t)) emitted++
        }

        assertEquals(4, emitted)
    }
}
