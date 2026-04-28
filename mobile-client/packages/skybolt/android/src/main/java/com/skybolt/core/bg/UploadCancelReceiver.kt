package com.skybolt.core.bg

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.skybolt.core.facade.SkyboltManager
import com.skybolt.core.util.logger
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/**
 * BroadcastReceiver para manejar cancelación de sesiones desde notificaciones.
 * 
 * Escucha la acción ACTION_CANCEL_SESSION enviada cuando el usuario presiona
 * el botón "Cancelar" en la notificación de upload.
 * 
 * Este receiver está registrado en el AndroidManifest del módulo Skybolt,
 * por lo que funciona automáticamente sin necesidad de código adicional en la app host.
 */
class UploadCancelReceiver : BroadcastReceiver() {
    private val log by logger()
    
    // Scope para operaciones asíncronas
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    
    override fun onReceive(context: Context?, intent: Intent?) {
        if (context == null || intent == null) {
            log.w { "UploadCancelReceiver: null context or intent" }
            return
        }
        
        // Verificar que sea la acción correcta
        if (intent.action != Foreground.ACTION_CANCEL_SESSION) {
            log.w { "UploadCancelReceiver: unexpected action ${intent.action}" }
            return
        }
        
        // Extraer sessionId del intent
        val sessionId = intent.getStringExtra(Foreground.EXTRA_SESSION_ID)
        if (sessionId.isNullOrBlank()) {
            log.w { "UploadCancelReceiver: missing sessionId in intent" }
            return
        }
        
        log.i { "UploadCancelReceiver: Cancel requested for session $sessionId" }
        
        // Usar goAsync() para operaciones que pueden tomar tiempo
        // Esto previene que el sistema mate el receiver prematuramente
        val pendingResult = goAsync()
        
        scope.launch {
            try {
                // Cancelar la sesión usando SkyboltManager
                log.d { "Canceling session $sessionId from notification..." }
                SkyboltManager.cancelSession(sessionId)
                log.i { "✅ Session $sessionId canceled successfully from notification" }
            } catch (e: Exception) {
                log.e(e) { "❌ Failed to cancel session $sessionId from notification" }
            } finally {
                // Indicar que el procesamiento asíncrono terminó
                pendingResult.finish()
            }
        }
    }
}
