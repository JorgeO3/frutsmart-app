package expo.modules.skybolt.core.bg

/**
 * Control flow exceptions for upload execution.
 * Used to signal pauses or retries from deep within the upload logic.
 */
sealed class Halt : Exception() {
    class AuthPause : Halt()
    class NetworkPause : Halt()
    class RetryLater : Halt()
}
