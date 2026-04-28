package expo.modules.skybolt.core.auth

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.first

private val Context.authDataStore by preferencesDataStore(
    name = "skybolt_auth_state"
)

class DataStoreAuthPersistence(appContext: Context) : AuthPersistence {

    private val dataStore = appContext.authDataStore

    override suspend fun load(): AuthTokens? {
        val prefs = dataStore.data.first()

        val id = prefs[KEY_ID_TOKEN] ?: return null
        val access = prefs[KEY_ACCESS_TOKEN] ?: return null
        val accessExpiresAt = prefs[KEY_ACCESS_EXPIRES_AT_MS] ?: return null
        val refresh = prefs[KEY_REFRESH_TOKEN] ?: return null
        val refreshExpiresAt = prefs[KEY_REFRESH_EXPIRES_AT_MS] ?: return null

        return AuthTokens(
            idToken = id,
            accessToken = access,
            accessExpiresAtMs = accessExpiresAt,
            refreshToken = refresh,
            refreshExpiresAtMs = refreshExpiresAt
        )
    }

    override suspend fun save(tokens: AuthTokens?) {
        dataStore.edit { prefs ->
            if (tokens == null) return@edit prefs.clear()

            prefs[KEY_ID_TOKEN] = tokens.idToken
            prefs[KEY_ACCESS_TOKEN] = tokens.accessToken
            prefs[KEY_ACCESS_EXPIRES_AT_MS] = tokens.accessExpiresAtMs
            prefs[KEY_REFRESH_TOKEN] = tokens.refreshToken
            prefs[KEY_REFRESH_EXPIRES_AT_MS] = tokens.refreshExpiresAtMs
        }
    }

    companion object {
        private val KEY_ACCESS_TOKEN = stringPreferencesKey("access_token")
        private val KEY_REFRESH_TOKEN = stringPreferencesKey("refresh_token")
        private val KEY_ID_TOKEN = stringPreferencesKey("id_token")
        private val KEY_ACCESS_EXPIRES_AT_MS = longPreferencesKey("access_expires_at_ms")
        private val KEY_REFRESH_EXPIRES_AT_MS = longPreferencesKey("refresh_expires_at_ms")
    }
}
