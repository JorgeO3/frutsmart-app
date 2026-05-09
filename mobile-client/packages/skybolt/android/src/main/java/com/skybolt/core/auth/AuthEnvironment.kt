package com.skybolt.core.auth

import android.content.Context
import com.skybolt.core.util.logger
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

object AuthEnvironment {
    private val log by logger()
    
    @Volatile
    private var initialized = false

    lateinit var manager: AuthManager
        private set

    private val mutex = Mutex()

    val isInitialized: Boolean
        get() = initialized

    suspend fun ensureInitialized(
        appContext: Context,
        refresher: TokenRefresher?,
        onAuthRequired: (() -> Unit)?
    ) {
        mutex.withLock {
            if (initialized && refresher == null) {
                log.d { "AuthEnvironment already initialized" }
                return@withLock
            }

            if (initialized) {
                log.i { "Reconfiguring AuthEnvironment" }
            } else {
                log.i { "Initializing AuthEnvironment" }
            }
            val persistence = DataStoreAuthPersistence(appContext)

            manager = AuthManager(
                persistence = persistence,
                refresher = refresher,
                onAuthRequired = onAuthRequired
            )

            initialized = true
            log.i { "AuthEnvironment initialized successfully" }
        }
    }

    suspend fun resetForTests() {
        mutex.withLock {
            if (!initialized) return@withLock
            log.w { "Resetting AuthEnvironment for tests" }
            manager.clear()
            initialized = false
        }
    }
}
