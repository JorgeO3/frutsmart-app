package expo.modules.skybolt.core.config

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.first
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import expo.modules.skybolt.core.util.logger

private val Context.settingsDataStore by preferencesDataStore(
    name = "skybolt_settings"
)

class DataStoreSettingsPersistence(appContext: Context) : SettingsPersistence {
    private val log by logger()
    private val dataStore = appContext.settingsDataStore
    private val json = Json { ignoreUnknownKeys = true }

    override suspend fun load(): CloudUploadSettings? {
        return try {
            val prefs = dataStore.data.first()
            val jsonString = prefs[KEY_SETTINGS_JSON] ?: return null
            json.decodeFromString<CloudUploadSettings>(jsonString)
        } catch (e: Exception) {
            log.e(e) { "Failed to load Skybolt settings, ignoring persisted state" }
            null
        }
    }

    override suspend fun save(settings: CloudUploadSettings?) {
        dataStore.edit { prefs ->
            if (settings == null) {
                prefs.remove(KEY_SETTINGS_JSON)
            } else {
                prefs[KEY_SETTINGS_JSON] = json.encodeToString(settings)
            }
        }
    }

    companion object {
        private val KEY_SETTINGS_JSON = stringPreferencesKey("settings_json")
    }
}
