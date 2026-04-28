package expo.modules.skybolt.azureblob.runtime

import okhttp3.MediaType
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.RequestBody
import okio.BufferedSink

/**
 * RequestBody optimizado para archivos pequeños cargados en memoria.
 * Evita la doble lectura de disco al subir directamente desde un ByteArray.
 * 
 * Usado en el path de optimización para archivos < 512KB.
 * 
 * @param data Contenido del archivo ya cargado en memoria
 * @param contentType MIME type del archivo (ej. "image/jpeg")
 */
internal class ByteArrayRequestBody(
    private val data: ByteArray,
    private val contentType: String?
) : RequestBody() {
    
    override fun contentType(): MediaType? = 
        contentType?.toMediaTypeOrNull()
    
    override fun contentLength(): Long = data.size.toLong()
    
    override fun writeTo(sink: BufferedSink) {
        sink.write(data)
    }
}
