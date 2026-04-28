package expo.modules.skybolt.core.config

interface SettingsPersistence {
    suspend fun load(): CloudUploadSettings?
    suspend fun save(settings: CloudUploadSettings?)
}
