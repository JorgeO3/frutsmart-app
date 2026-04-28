package com.skybolt.core.storage

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.core.stringSetPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.skybolt.core.util.logger
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlin.collections.minus
import kotlin.collections.plus
import kotlin.collections.toSet
import kotlin.text.isNotBlank

// DataStore de índice: declarar a nivel de archivo (patrón recomendado) para evitar instancias duplicadas.
private val Context.sessionsIndexStore: DataStore<Preferences> by preferencesDataStore(
    name = "cloudupload_sessions_index"
)

/**
 * Índice persistente y liviano de sesiones.
 * - Guarda un set de sessionIds y metadatos (última actualización y estado textual opcional).
 * - Ideal para listar y reanudar al arrancar la app.
 *
 * NOTA: El estado completo de cada sesión vive en tu DataStore Proto por sesión.
 */
class SessionsIndex(appContext: Context) {
    private val log by logger()
    private val store: DataStore<Preferences> = appContext.applicationContext.sessionsIndexStore

    private val keyIds = stringSetPreferencesKey("ids")
    private val keyPrefixUpdatedAt = "updated_at_"          // + sessionId
    private val keyPrefixStatus = "status_"                  // + sessionId

    private fun updatedAtKey(sessionId: String) = longPreferencesKey(keyPrefixUpdatedAt + sessionId)

    private fun statusKey(sessionId: String) = stringPreferencesKey(keyPrefixStatus + sessionId)

    /**
     * Agrega (o confirma) la existencia del sessionId en el índice.
     * También actualiza opcionalmente status y marca updatedAt = now.
     */
    suspend fun upsert(
        sessionId: String, status: String? = null, updatedAtMs: Long = System.currentTimeMillis()
    ) {
        require(sessionId.isNotBlank()) { "sessionId must not be blank" }
        log.v { "Upserting session index: $sessionId, status=$status" }
        store.edit { prefs ->
            val current = prefs[keyIds] ?: emptySet()
            prefs[keyIds] = (current + sessionId).toSet()
            prefs[updatedAtKey(sessionId)] = updatedAtMs
            if (status != null) prefs[statusKey(sessionId)] = status
        }
    }

    /** Elimina un sessionId del índice y sus metadatos. */
    suspend fun remove(sessionId: String) {
        require(sessionId.isNotBlank()) { "sessionId must not be blank" }
        log.d { "Removing session from index: $sessionId" }
        store.edit { prefs ->
            val current = prefs[keyIds] ?: emptySet()
            prefs[keyIds] = (current - sessionId).toSet()
            prefs.remove(updatedAtKey(sessionId))
            prefs.remove(statusKey(sessionId))
        }
    }

    /** Devuelve el listado actual de sessionIds. */
    fun idsFlow(): Flow<Set<String>> = store.data.map { (it[keyIds] ?: emptySet()).toSet() }

    /** Versión suspend que lee una vez. */
    suspend fun idsOnce(): Set<String> = idsFlow().first()

    /** ¿Existe en el índice? */
    suspend fun contains(sessionId: String): Boolean = sessionId in idsOnce()

    /** Última actualización (ms) o null si no existe. */
    fun updatedAtFlow(sessionId: String): Flow<Long?> =
        store.data.map { it[updatedAtKey(sessionId)] }

    /** Estado textual almacenado (opcional). */
    fun statusFlow(sessionId: String): Flow<String?> = store.data.map { it[statusKey(sessionId)] }

    /** Actualiza sólo el estado y el updatedAt. */
    suspend fun touch(
        sessionId: String, status: String? = null, updatedAtMs: Long = System.currentTimeMillis()
    ) {
        require(sessionId.isNotBlank()) { "sessionId must not be blank" }
        if (!contains(sessionId)) return
        log.v { "Touching session index: $sessionId, status=$status" }
        store.edit { prefs ->
            prefs[updatedAtKey(sessionId)] = updatedAtMs
            if (status != null) prefs[statusKey(sessionId)] = status
        }
    }

    /** Limpia todo el índice (no borra tus archivos Proto de sesión). */
    suspend fun clearAll() {
        log.w { "Clearing all sessions index" }
        store.edit { it.clear() }
    }

    /** Estado textual almacenado (lectura única). */
    suspend fun getStatus(sessionId: String): String? {
        return store.data.map { it[statusKey(sessionId)] }.first()
    }

    /** Obtiene un mapa de todos los sessionIds a sus estados. */
    suspend fun getAllStatuses(): Map<String, String> {
        return store.data.map { prefs ->
            val ids = prefs[keyIds] ?: emptySet()
            ids.associateWith { id -> prefs[statusKey(id)] ?: "" }
        }.first()
    }
}
