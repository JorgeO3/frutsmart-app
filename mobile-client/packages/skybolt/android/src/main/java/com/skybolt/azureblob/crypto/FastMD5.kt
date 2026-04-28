package com.skybolt.azureblob.crypto

import android.content.ContentResolver
import android.content.Context
import android.net.Uri
import android.provider.DocumentsContract
import android.util.Base64
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit
import kotlinx.coroutines.withContext
import java.security.MessageDigest
import kotlin.math.max
import kotlin.math.min

/**
 * FastMD5: utilidades MD5 optimizadas (2025)
 * - Sin memory-pool global (ThreadLocal para digest y buffer).
 * - Lectura en una sola pasada, cancelación cooperativa.
 * - 4 funciones públicas: HEX/Base64, single/batch.
 */
object FastMD5 {

    // ======== Resultados ========
    data class Md5HexResult(
        val uri: String,
        val md5Hex: String,
        val sizeBytes: Long,
        val contentType: String?,
        val lastModifiedMs: Long?,
    )

    data class Md5Base64Result(
        val uri: String,
        val md5Base64: String,
        val sizeBytes: Long,
        val contentType: String?,
        val lastModifiedMs: Long?,
    )

    // ======== API pública ========
    suspend fun computeMd5Hex(ctx: Context, uri: Uri): Md5HexResult =
        withContext(Dispatchers.IO) {
            digestUri(ctx, uri, wantHex = true, wantB64 = false) as Md5HexResult
        }

    suspend fun computeMd5HexBatch(
        ctx: Context,
        uris: List<String>,
        parallelism: Int = defaultParallelism()
    ): List<Md5HexResult> = coroutineScope {
        val sem = Semaphore(parallelism)
        val dispatcher = Dispatchers.IO.limitedParallelism(parallelism)
        uris
            .asSequence()
            .map(String::trim)
            .filter(String::isNotEmpty).map(Uri::parse)
            .map { u -> async(dispatcher) { sem.withPermit { computeMd5Hex(ctx, u) } } }
            .toList()
            .awaitAll()
    }

    suspend fun computeMd5Base64(ctx: Context, uri: Uri): Md5Base64Result =
        withContext(Dispatchers.IO) {
            digestUri(ctx, uri, wantHex = false, wantB64 = true) as Md5Base64Result
        }

    suspend fun computeMd5Base64Batch(
        ctx: Context,
        uris: List<String>,
        parallelism: Int = defaultParallelism()
    ): List<Md5Base64Result> = coroutineScope {
        val sem = Semaphore(parallelism)
        val dispatcher = Dispatchers.IO.limitedParallelism(parallelism)
        uris
            .asSequence()
            .map(String::trim)
            .filter(String::isNotEmpty)
            .map(Uri::parse)
            .map { u -> async(dispatcher) { sem.withPermit { computeMd5Base64(ctx, u) } } }
            .toList()
            .awaitAll()
    }

    /**
     * Computes MD5 Base64 from a byte array using the thread-local MessageDigest.
     * Optimized for in-memory buffers.
     */
    fun computeMd5Base64(bytes: ByteArray): String {
        val md = md5()
        val digest = md.digest(bytes)
        return Base64.encodeToString(digest, Base64.NO_WRAP)
    }

    // ======== Núcleo: una sola pasada ========
    private suspend fun digestUri(
        ctx: Context,
        uri: Uri,
        wantHex: Boolean,
        wantB64: Boolean,
    ): Any = withContext(Dispatchers.IO) {
        require(wantHex || wantB64) { "At least one of HEX or Base64 must be requested" }

        val cr = ctx.contentResolver
        val (mime, lastModified) = metaOf(cr, uri)

        val md = md5()           // <-- no-nulo
        val buf = buffer()       // <-- no-nulo
        var total = 0L

        cr.openInputStream(uri)?.use { stream ->
            while (true) {
                ensureActive()
                val n = stream.read(buf)
                if (n <= 0) break
                md.update(buf, 0, n)
                total += n
            }
        } ?: error("Unable to open InputStream for $uri")

        val digest = md.digest()

        return@withContext when {
            wantHex -> Md5HexResult(
                uri = uri.toString(),
                md5Hex = toHexFast(digest),
                sizeBytes = total,
                contentType = mime,
                lastModifiedMs = lastModified
            )

            else -> Md5Base64Result(
                uri = uri.toString(),
                md5Base64 = Base64.encodeToString(digest, Base64.NO_WRAP),
                sizeBytes = total,
                contentType = mime,
                lastModifiedMs = lastModified
            )
        }
    }

    // ======== Metadatos (best-effort) ========
    private fun metaOf(cr: ContentResolver, uri: Uri): Pair<String?, Long?> {
        val mime = runCatching { cr.getType(uri) }.getOrNull()
        val lastMod = runCatching {
            cr.query(
                uri,
                arrayOf(DocumentsContract.Document.COLUMN_LAST_MODIFIED),
                null, null, null
            )?.use { cursor ->
                val idx = cursor.getColumnIndex(DocumentsContract.Document.COLUMN_LAST_MODIFIED)
                if (idx >= 0 && cursor.moveToFirst()) cursor.getLong(idx) else null
            }
        }.getOrNull()
        return mime to lastMod
    }

    // ======== Micro-opt helpers ========
    private inline fun <T : Any> ThreadLocal<T>.getOrInit(crossinline init: () -> T): T {
        val v = get()
        if (v != null) return v
        val nv = init()
        set(nv)
        return nv
    }

    /** ThreadLocal no-nulo para MD5. */
    private val MD_TL: ThreadLocal<MessageDigest> =
        ThreadLocal.withInitial { MessageDigest.getInstance("MD5") }

    /** Obtiene y resetea el digest (siempre no-nulo). */
    private fun md5(): MessageDigest =
        MD_TL.getOrInit { MessageDigest.getInstance("MD5") }.also { it.reset() }


    /** ThreadLocal no-nulo para buffer grande (evita allocs en hot-path). */
    private val BUF_TL: ThreadLocal<ByteArray> =
        ThreadLocal.withInitial { ByteArray(BUF_SIZE) }

    private fun buffer(): ByteArray =
        BUF_TL.getOrInit { ByteArray(BUF_SIZE) }


    private const val BUF_SIZE = 512 * 1024 // 512KiB

    // Tabla precalculada para HEX (rápida)
    private val HEX = CharArray(512).also {
        val chars = "0123456789abcdef".toCharArray()
        var j = 0
        for (b in 0..255) {
            it[j++] = chars[b ushr 4]
            it[j++] = chars[b and 0x0F]
        }
    }

    private fun toHexFast(bytes: ByteArray): String {
        val out = CharArray(bytes.size * 2)
        var i = 0
        var j = 0
        while (i < bytes.size) {
            val v = bytes[i].toInt() and 0xFF
            out[j] = HEX[v shl 1]
            out[j + 1] = HEX[(v shl 1) + 1]
            i++; j += 2
        }
        return String(out)
    }

    private fun defaultParallelism(): Int {
        val cores = Runtime.getRuntime().availableProcessors()
        return min(4, max(1, cores / 2))
    }
}
