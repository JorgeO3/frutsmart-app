package com.skybolt.core.net

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Network as AndroidNetwork // <-- alias para evitar colisión con tu object Network
import com.skybolt.core.util.logger
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.filter
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.withTimeoutOrNull
import java.io.Closeable

/**
 * Observa cambios de conectividad y expone un StateFlow<NetState>.
 * minSdk 24: usa registerDefaultNetworkCallback.
 */
class NetworkWatcher(context: Context) : Closeable {
    private val log by logger()
    private val appContext = context.applicationContext

    private val cm =
        appContext.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager

    private val _state = MutableStateFlow(Network.snapshot(appContext))
    val state: StateFlow<NetState> = _state.asStateFlow()

    private var started = false
    private var callback: ConnectivityManager.NetworkCallback? = null

    fun start() {
        if (started) return
        started = true
        log.d { "NetworkWatcher started" }

        val cb = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: AndroidNetwork) {
                updateState("onAvailable")
            }
            override fun onLost(network: AndroidNetwork) {
                updateState("onLost")
            }
            override fun onCapabilitiesChanged(
                network: AndroidNetwork,
                networkCapabilities: NetworkCapabilities
            ) {
                updateState("onCapabilitiesChanged")
            }
        }
        callback = cb
        cm.registerDefaultNetworkCallback(cb)
        updateState("initial")
    }

    private fun updateState(reason: String) {
        val newState = Network.snapshot(appContext)
        if (_state.value != newState) {
            log.i { "Network state changed ($reason): connected=${newState.isConnected}, metered=${newState.isMetered}" }
            _state.value = newState
        }
    }

    fun stop() {
        if (!started) return
        started = false
        log.d { "NetworkWatcher stopped" }
        callback?.let { runCatching { cm.unregisterNetworkCallback(it) } }
        callback = null
    }

    override fun close() = stop()

    suspend fun awaitConnected(timeoutMs: Long? = null): Boolean {
        val flow = state
            .map { it.isConnected }
            .distinctUntilChanged()
            .filter { it }

        return if (timeoutMs != null) {
            withTimeoutOrNull(timeoutMs) { flow.first() } != null
        } else {
            flow.first(); true
        }
    }

    suspend fun awaitDisconnected(timeoutMs: Long? = null): Boolean {
        val flow = state
            .map { it.isConnected }
            .distinctUntilChanged()
            .filter { connected -> !connected }

        return if (timeoutMs != null) {
            withTimeoutOrNull(timeoutMs) { flow.first() } != null
        } else {
            flow.first(); true
        }
    }
}
