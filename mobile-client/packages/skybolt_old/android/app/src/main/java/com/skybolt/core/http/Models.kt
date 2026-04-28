package com.skybolt.core.http

import kotlinx.serialization.Serializable

// ---- SAS batch / refresh ----
@Serializable
data class SasBatchRequest(
    val items: List<SasItem>
)

@Serializable
data class SasItem(
    val blobName: String,
    val contentType: String,
)

@Serializable
data class SasGrant(
    val blobName: String,
    val url: String,
    val blobUrl: String,
    val expiresOn: String,
)

@Serializable
data class SasBatchResponse(
    val sas: List<SasGrant>
)

@Serializable
data class SasRefreshRequest(
    val blobNames: List<String>
)

typealias SasRefreshResponse = SasBatchResponse
