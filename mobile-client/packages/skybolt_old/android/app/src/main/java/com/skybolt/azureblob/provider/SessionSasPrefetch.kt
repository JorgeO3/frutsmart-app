package com.skybolt.azureblob.provider

import com.skybolt.core.upload.api.ItemSpec

interface SessionSasPrefetch {
    suspend fun preloadSas(items: List<ItemSpec>)
}