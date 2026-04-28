package com.skybolt.core.storage

import androidx.datastore.core.CorruptionException
import androidx.datastore.core.Serializer
import com.skybolt.proto.UploadSessionState
import java.io.InputStream
import java.io.OutputStream

object UploadSessionStateSerializer : Serializer<UploadSessionState> {
    override val defaultValue: UploadSessionState = UploadSessionState.getDefaultInstance()

    override suspend fun readFrom(input: InputStream): UploadSessionState =
        try { UploadSessionState.parseFrom(input) }
        catch (t: Throwable) { throw CorruptionException("Cannot read UploadSessionState", t) }

    override suspend fun writeTo(t: UploadSessionState, output: OutputStream) = t.writeTo(output)
}