package expo.modules.skybolt.core.upload.api

import android.content.Context
import expo.modules.skybolt.core.upload.planner.UploadPlan
import kotlinx.coroutines.CoroutineScope

/**
 * Fachada de alto nivel para subir usando Azure Block Blob.
 * Implementa la orquestación mínima y delega la subida real
 * a un LowLevelUploader (que viviría en impl/).
 */
interface Uploader {
    /**
     * Sube un único item con un plan ya calculado.
     */
    suspend fun uploadItem(
        context: Context,
        scope: CoroutineScope,
        sessionId: String,
        item: ItemSpec,
        plan: UploadPlan,
        reporter: ProgressReporter
    )

    /**
     * Sube varios items en paralelo (según options.maxParallelFiles)
     * calculando el plan de cada uno con UploadPlanner.
     */
    suspend fun uploadSession(
        context: Context,
        scope: CoroutineScope,
        session: SessionSpec,
        reporter: ProgressReporter
    ): List<Unit>
}

/**
 * Esta interfaz la implementará tu uploader real (impl/).
 * El Driver la recibe por composición para desacoplar.
 */
interface LowLevelUploader {
    suspend fun uploadBlockBlob(
        context: Context,
        scope: CoroutineScope,
        sessionId: String,
        item: ItemSpec,
        plan: UploadPlan,
        reporter: ProgressReporter
    )
}
