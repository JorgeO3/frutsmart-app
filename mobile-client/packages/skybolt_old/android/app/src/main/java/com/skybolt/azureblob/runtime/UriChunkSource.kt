package com.skybolt.azureblob.runtime

import android.content.ContentResolver
import android.content.Context
import androidx.core.net.toUri
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.InputStream
import kotlin.collections.copyOf
import kotlin.io.use

/**
 * Lee un archivo (content:// o file://) en chunks.
 * Optimización C9: Usa buffer pooling para reducir allocations y GC pressure.
 */
object UriChunkSource {

    // Buffer pool para reutilizar ByteArrays
    private val bufferPool = ArrayDeque<ByteArray>()
    private val poolLock = Any()
    private const val MAX_POOL_SIZE = 8
    private const val BUFFER_SIZE = 4 * 1024 * 1024 // 4MB

    private fun acquireBuffer(): ByteArray = synchronized(poolLock) {
        bufferPool.removeFirstOrNull() ?: ByteArray(BUFFER_SIZE)
    }

    private fun releaseBuffer(buffer: ByteArray) = synchronized(poolLock) {
        if (bufferPool.size < MAX_POOL_SIZE && buffer.size == BUFFER_SIZE) {
            bufferPool.addLast(buffer)
        }
    }

    /**
     * Lee un rango [offset, offset+size) desde la Uri y retorna un ByteArray exacto.
     */
    suspend fun read(
        context: Context,
        uriString: String,
        offset: Long,
        size: Int
    ): ByteArray = withContext(Dispatchers.IO) {
        require(size <= BUFFER_SIZE) { "Chunk size $size exceeds buffer capacity $BUFFER_SIZE" }

        val buffer = acquireBuffer()
        try {
            val uri = uriString.toUri()
            val cr: ContentResolver = context.contentResolver
            cr.openInputStream(uri)?.use { input ->
                skipFully(input, offset)
                readIntoBuffer(input, buffer, size)
            } ?: error("Cannot open InputStream for $uriString")
        } finally {
            releaseBuffer(buffer)
        }
    }

    private fun skipFully(input: InputStream, bytes: Long) {
        var toSkip = bytes
        while (toSkip > 0) {
            val skipped = input.skip(toSkip)
            if (skipped <= 0) throw kotlin.IllegalStateException("Unable to skip $bytes bytes")
            toSkip -= skipped
        }
    }

    private fun readIntoBuffer(input: InputStream, buffer: ByteArray, size: Int): ByteArray {
        var read = 0
        while (read < size) {
            val r = input.read(buffer, read, size - read)
            if (r < 0) throw kotlin.IllegalStateException("Unexpected EOF while reading $size bytes")
            read += r
        }
        // Solo copiar el tamaño exacto necesario
        return buffer.copyOf(size)
    }
}
