package com.skybolt.core.bg

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Color
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.work.ForegroundInfo
import kotlin.math.abs

/**
 * Notificación/ForegroundInfo para trabajos de subida prolongados.
 * Sin dependencias a Activities específicas (usa el launcher de la app host).
 */
object Foreground {

    const val CHANNEL_ID = "cloudupload_transfers"
    private const val CHANNEL_NAME = "CloudUpload"
    private const val CHANNEL_DESC = "Subidas de archivos en progreso"
    private const val GROUP_KEY = "cloudupload_group"
    private const val NOTIF_ID_BASE: Int = 0x0C10

    // Acción para cancelar sesiones (manejada por UploadCancelReceiver)
    const val ACTION_CANCEL_SESSION = "com.jorgeo3.cloudupload.ACTION_CANCEL_SESSION"
    const val EXTRA_SESSION_ID = "session_id"

    fun ensureChannel(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val chan = NotificationChannel(
            CHANNEL_ID,
            CHANNEL_NAME,
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = CHANNEL_DESC
            enableVibration(false)
            enableLights(false)
            lightColor = Color.BLUE
            setShowBadge(false)
            lockscreenVisibility = Notification.VISIBILITY_PRIVATE
        }
        nm.createNotificationChannel(chan)
    }

    fun foregroundInfo(
        context: Context,
        sessionId: String,
        progressPercent: Int = -1,
        text: String = "Subiendo archivos…"
    ): ForegroundInfo {
        val notif = buildNotification(context, sessionId, progressPercent, text)
        val id: Int = notificationIdFor(sessionId)
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ForegroundInfo(id, notif, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
        } else {
            ForegroundInfo(id, notif)
        }
    }

    private fun notificationIdFor(sessionId: String): Int =
        NOTIF_ID_BASE + (abs(sessionId.hashCode()) and 0x00FFFFFF)

    private fun buildNotification(
        context: Context,
        sessionId: String,
        progressPercent: Int,
        text: String
    ): Notification {
        ensureChannel(context)

        // 1) PendingIntent seguro que abre la app host (launcher activity)
        val launchIntent = context.packageManager
            .getLaunchIntentForPackage(context.packageName)
            ?.apply {
                addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
                putExtra(EXTRA_SESSION_ID, sessionId) // por si la app quiere leerlo
            }
        
        // Fallback: si no hay launcher, usamos un intent vacío que no hace nada al clickear
        // O podríamos usar ACTION_VIEW, pero sin data puede fallar. Mejor null si no es crítico.
        val contentIntent = if (launchIntent != null) {
            PendingIntent.getActivity(
                context,
                1000 + abs(sessionId.hashCode()),
                launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
        } else {
            null
        }

        // 2) Acción “Cancelar” opcional (requiere que la app host registre un receiver)
        val cancelIntent = PendingIntent.getBroadcast(
            context,
            2000 + abs(sessionId.hashCode()),
            Intent(ACTION_CANCEL_SESSION).apply { putExtra(EXTRA_SESSION_ID, sessionId) },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val shortId = sessionId.takeLast(6)

        val builder = NotificationCompat.Builder(context, CHANNEL_ID)
            .setContentTitle("CloudUpload • #$shortId")
            .setContentText(text)
            .setSubText("Sesión: $sessionId")
            .setSmallIcon(android.R.drawable.stat_sys_upload) // cámbialo a tu icono
            .setOnlyAlertOnce(true)
            .setOngoing(true)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
            .setLocalOnly(true)
            .setSilent(true)
            .setAutoCancel(false)
            .setGroup(GROUP_KEY)
            .setContentIntent(contentIntent)
            .addAction(
                android.R.drawable.ic_menu_close_clear_cancel,
                "Cancelar",
                cancelIntent
            )
            .setStyle(NotificationCompat.BigTextStyle().bigText(text))

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            builder.setForegroundServiceBehavior(
                NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE
            )
        }

        if (progressPercent < 0) {
            builder.setProgress(0, 0, true)
        } else {
            builder.setProgress(100, progressPercent.coerceIn(0, 100), false)
        }

        return builder.build()
    }
}
