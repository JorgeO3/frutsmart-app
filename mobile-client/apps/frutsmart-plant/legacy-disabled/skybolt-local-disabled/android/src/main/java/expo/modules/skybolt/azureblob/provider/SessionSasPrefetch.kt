package expo.modules.skybolt.azureblob.provider

import expo.modules.skybolt.core.upload.api.ItemSpec

interface SessionSasPrefetch {
    suspend fun preloadSas(items: List<ItemSpec>)
}