package com.skybolt.core.http

import com.skybolt.core.auth.AuthEnvironment
import kotlinx.coroutines.runBlocking

/**
 * Proveedor de cabeceras de autenticación para llamadas HTTP.
 *
 * - [authorization] debe devolver el **valor** completo del header Authorization
 *   (p. ej. "Bearer eyJ...") o `null` si no hay token disponible.
 * - [extraHeaders] permite adjuntar cabeceras adicionales (API-Keys, app-id, etc.).
 */
interface AuthHeaderProvider {
    fun authorization(): String?
    fun extraHeaders(): Map<String, String> = emptyMap()
}


class AuthManagerBearerProvider : AuthHeaderProvider {

    override fun authorization(): String? {
        // Si AuthEnvironment aún no está inicializado, no añadimos auth
        if (!AuthEnvironment.isInitialized) {
            return null
        }

        val manager = AuthEnvironment.manager

        val token = runBlocking {
            manager.getValidAccessTokenOrNull()
        } ?: return null

        val raw = token.trim()
        if (raw.isEmpty()) return null

        return if (raw.startsWith("Bearer ", ignoreCase = true)) {
            raw
        } else {
            "Bearer $raw"
        }
    }
}
/**
 * Composición de varios proveedores: usa el primero que entregue Authorization
 * y fusiona sus headers extra con los de los demás (último gana).
 */
class CompositeAuthProvider(
    private vararg val providers: AuthHeaderProvider
) : AuthHeaderProvider {

    override fun authorization(): String? =
        providers.firstNotNullOfOrNull { it.authorization() }

    override fun extraHeaders(): Map<String, String> =
        buildMap {
            providers.forEach { putAll(it.extraHeaders()) }
        }
}

/** Proveedor nulo (útil para pruebas locales sin auth). */
object NoAuthProvider : AuthHeaderProvider {
    override fun authorization(): String? = null
}

class StaticHeadersProvider(
    private val headers: Map<String, String>
) : AuthHeaderProvider {
    override fun authorization(): String? = null

    override fun extraHeaders(): Map<String, String> = headers
}
