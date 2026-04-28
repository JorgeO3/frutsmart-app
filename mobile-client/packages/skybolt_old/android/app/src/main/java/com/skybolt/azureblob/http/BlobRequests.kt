package com.skybolt.azureblob.http

import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.Request
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.toRequestBody

/**
 * Builders HTTP crudos contra Azure Blob Storage (sin SDK).
 * Cubre: PUT Blob (single), PUT Block, PUT BlockList.
 */
object BlobRequests {

    private val OCTET = "application/octet-stream".toMediaType()
    private val XML   = "application/xml; charset=utf-8".toMediaType()

    private fun hasSasVersion(url: HttpUrl): Boolean =
        !url.queryParameter("sv").isNullOrBlank()

    /** PUT Blob (single upload). Body = datos del archivo completo. */
    @JvmOverloads
    fun putBlob(
        sasUrl: String,
        body: RequestBody,
        contentType: String? = null,
        contentMd5B64: String? = null,
        apiVersion: String = "2023-11-03",
        clientRequestId: String? = null
    ): Request {
        val url: HttpUrl = sasUrl.toHttpUrlOrNull() ?: error("Invalid SAS URL")
        return Request.Builder()
            .url(url)
            .put(body)
            .apply {
                // Si la URL ya trae sv= (SAS version), no fuerces x-ms-version para evitar incompatibilidades (Azurite/SDKs)
                if (!hasSasVersion(url) && apiVersion.isNotBlank()) header("x-ms-version", apiVersion)
            }
            .header("x-ms-blob-type", "BlockBlob") // requerido para PUT Blob
            .apply {
                if (!contentType.isNullOrBlank()) header("Content-Type", contentType)
                if (!contentMd5B64.isNullOrBlank()) header("Content-MD5", contentMd5B64)
                if (!clientRequestId.isNullOrBlank()) header("x-ms-client-request-id", clientRequestId)
            }
            .build()
    }

    /** PUT Block: comp=block&blockid=<base64>  body = bytes del chunk */
    @JvmOverloads
    fun putBlock(
        sasUrl: String,
        blockIdB64: String,
        bytes: ByteArray,
        contentMd5B64: String? = null,
        apiVersion: String = "2023-11-03",
        clientRequestId: String? = null
    ): Request {
        val base: HttpUrl = sasUrl.toHttpUrlOrNull() ?: error("Invalid SAS URL")
        val url = base.newBuilder()
            .addQueryParameter("comp", "block")
            .addQueryParameter("blockid", blockIdB64) // OkHttp escapa + / = correctamente
            .build()

        val body: RequestBody = bytes.toRequestBody(OCTET)
        return Request.Builder()
            .url(url)
            .put(body)
            .apply {
                if (!hasSasVersion(url) && apiVersion.isNotBlank()) header("x-ms-version", apiVersion)
            }
            .apply {
                if (!contentMd5B64.isNullOrBlank()) header("Content-MD5", contentMd5B64)
                if (!clientRequestId.isNullOrBlank()) header("x-ms-client-request-id", clientRequestId)
            }
            .build()
    }

    /** PUT Block List: comp=blocklist  body = XML con <Latest>ids… */
    @JvmOverloads
    fun putBlockList(
        sasUrl: String,
        blockIdsB64: List<String>,
        contentType: String? = null,
        blobContentMd5B64: String? = null,
        apiVersion: String = "2023-11-03",
        clientRequestId: String? = null
    ): Request {
        val base: HttpUrl = sasUrl.toHttpUrlOrNull() ?: error("Invalid SAS URL")
        val url = base.newBuilder()
            .addQueryParameter("comp", "blocklist")
            .build()

        val xml = buildXml(blockIdsB64)
        val body = xml.toRequestBody(XML)

        return Request.Builder()
            .url(url)
            .put(body)
            .apply {
                if (!hasSasVersion(url) && apiVersion.isNotBlank()) header("x-ms-version", apiVersion)
            }
            .apply {
                // Establece el content-type del blob al hacer commit
                if (!contentType.isNullOrBlank()) header("x-ms-blob-content-type", contentType)
                if (!blobContentMd5B64.isNullOrBlank()) {
                    header("x-ms-blob-content-md5", blobContentMd5B64)
                }
                if (!clientRequestId.isNullOrBlank()) header("x-ms-client-request-id", clientRequestId)
            }
            .build()
    }

    private fun buildXml(ids: List<String>): String = buildString(
        capacity = 64 + ids.sumOf { it.length + 17 } // <Latest>...</Latest>
    ) {
        append("""<?xml version="1.0" encoding="utf-8"?>""")
        append("<BlockList>")
        ids.forEach { id -> append("<Latest>").append(id).append("</Latest>") }
        append("</BlockList>")
    }
}
