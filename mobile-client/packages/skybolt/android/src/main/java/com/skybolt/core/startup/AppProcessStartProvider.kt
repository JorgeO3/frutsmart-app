package com.skybolt.core.startup

import android.content.ContentProvider
import android.content.ContentValues
import android.database.Cursor
import android.net.Uri
import com.skybolt.core.util.logger

class AppProcessStartProvider : ContentProvider() {
    private val log by logger()

    override fun onCreate(): Boolean {
        val ctx = context ?: return false
        StartupGate.markProcessStarted(ctx)
        log.i { "[DIAG] AppProcessStartProvider marked process start and nanort_ready=false at elapsedMs=${android.os.SystemClock.elapsedRealtime()}" }
        return true
    }

    override fun query(
        uri: Uri,
        projection: Array<out String>?,
        selection: String?,
        selectionArgs: Array<out String>?,
        sortOrder: String?,
    ): Cursor? = null

    override fun getType(uri: Uri): String? = null

    override fun insert(uri: Uri, values: ContentValues?): Uri? = null

    override fun delete(uri: Uri, selection: String?, selectionArgs: Array<out String>?): Int = 0

    override fun update(
        uri: Uri,
        values: ContentValues?,
        selection: String?,
        selectionArgs: Array<out String>?,
    ): Int = 0
}
