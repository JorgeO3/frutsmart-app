package com.skybolt.core.net

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities

enum class NetworkType { WIFI, CELLULAR, ETHERNET, VPN, OTHER, NONE }

data class NetState(
    val isConnected: Boolean,
    val isMetered: Boolean,
    val type: NetworkType
)

object Network {
    fun snapshot(context: Context): NetState {
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val active = cm.activeNetwork ?: return NetState(
            isConnected = false,
            isMetered = true,
            type = NetworkType.NONE
        )
        val caps = cm.getNetworkCapabilities(active) ?: return NetState(
            isConnected = false,
            isMetered = true,
            type = NetworkType.NONE
        )

        // Validated evita falsos positivos (p. ej., captive portal)
        val connected =
            caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
                    caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)

        // En minSdk 24 podemos usar directamente isActiveNetworkMetered
        val isMetered = cm.isActiveNetworkMetered

        val type = when {
            caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)      -> NetworkType.WIFI
            caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR)  -> NetworkType.CELLULAR
            caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET)  -> NetworkType.ETHERNET
            caps.hasTransport(NetworkCapabilities.TRANSPORT_VPN)       -> NetworkType.VPN
            else                                                       -> NetworkType.OTHER
        }

        return NetState(connected, isMetered, type)
    }
}
