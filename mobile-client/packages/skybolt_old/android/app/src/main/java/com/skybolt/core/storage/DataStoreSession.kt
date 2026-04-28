package com.skybolt.core.storage

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.core.MultiProcessDataStoreFactory
import androidx.datastore.core.handlers.ReplaceFileCorruptionHandler
import androidx.datastore.dataStoreFile

import java.io.File
import java.util.concurrent.ConcurrentHashMap
import com.skybolt.proto.UploadSessionState

private fun fileName(sessionId: String) = "upload_session_${sessionId}.pb"

/** Singleton por (sessionId) y proceso. */
object DataStoreSession {
    private val stores = ConcurrentHashMap<String, DataStore<UploadSessionState>>()

    /** Siempre devuelve la MISMA instancia por sessionId. */
    fun get(context: Context, sessionId: String): DataStore<UploadSessionState> =
        stores.getOrPut(sessionId) {
            val appCtx = context.applicationContext
            MultiProcessDataStoreFactory.create(
                serializer = UploadSessionStateSerializer,
                corruptionHandler = ReplaceFileCorruptionHandler {
                    UploadSessionState.getDefaultInstance()
                },
                // Ruta: /files/datastore/upload_session_<id>.pb
                produceFile = { appCtx.dataStoreFile(fileName(sessionId)) }
            )
        }

    /** Borra del caché (úsalo antes de eliminar el archivo físicamente). */
    fun drop(sessionId: String) {
        stores.remove(sessionId)
    }

    /** Elimina el archivo físico de forma segura. */
    fun deleteFile(context: Context, sessionId: String): Boolean {
        val f: File = context.applicationContext.dataStoreFile(fileName(sessionId))
        return f.delete()
    }
}
