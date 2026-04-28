package expo.modules.skybolt.core.http

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class RetryTest {

    @Test
    fun expBackoff_respectsBaseAndMaxDelay() {
        assertEquals(100L, expBackoff(attempt = 1, baseDelayMs = 100L, maxDelayMs = 1_000L))
        assertEquals(200L, expBackoff(attempt = 2, baseDelayMs = 100L, maxDelayMs = 1_000L))
        assertEquals(400L, expBackoff(attempt = 3, baseDelayMs = 100L, maxDelayMs = 1_000L))
        assertEquals(800L, expBackoff(attempt = 4, baseDelayMs = 100L, maxDelayMs = 1_000L))
        assertEquals(1_000L, expBackoff(attempt = 5, baseDelayMs = 100L, maxDelayMs = 1_000L))
        assertEquals(1_000L, expBackoff(attempt = 6, baseDelayMs = 100L, maxDelayMs = 1_000L))
    }

    @Test
    fun expBackoff_handlesAttemptZero() {
        val backoff = expBackoff(attempt = 0, baseDelayMs = 250L, maxDelayMs = 4_000L)
        assertTrue(backoff in 250L..4_000L)
        assertEquals(250L, backoff)
    }
}
