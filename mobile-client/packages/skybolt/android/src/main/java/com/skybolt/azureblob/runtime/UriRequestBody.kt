package com.skybolt.azureblob.runtime

import android.content.Context
import android.net.Uri
import okhttp3.MediaType
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.RequestBody
import okio.BufferedSink


internal class UriRequestBody(
    private val ctx: Context,
    private val uri: Uri,
    private val ct: String?,
    private val len: Long,
    private val bufferSize: Int = 512 * 1024
) : RequestBody() {
    override fun contentType(): MediaType? = ct?.toMediaTypeOrNull()
    override fun contentLength(): Long = len
    override fun writeTo(sink: BufferedSink) {
        val cr = ctx.contentResolver
        cr.openInputStream(uri)?.use { ins ->
            val buf = ByteArray(bufferSize)
            while (true) {
                val n = ins.read(buf)
                if (n <= 0) break
                sink.write(buf, 0, n)
            }
        } ?: error("Cannot open InputStream: $uri")
    }
}
