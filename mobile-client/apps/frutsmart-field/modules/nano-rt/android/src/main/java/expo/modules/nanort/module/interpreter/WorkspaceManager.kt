package expo.modules.nanort.module.interpreter

import expo.modules.nanort.core.ModuleLogger
import expo.modules.nanort.core.logD
import expo.modules.nanort.core.logI
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

import expo.modules.nanort.module.workflows.shared.classification.ClassificationWorkspace
import expo.modules.nanort.module.workflows.shared.segmentation.SegmentationWorkspace
import java.util.Locale


/**
 * Singleton que gestiona un pool de workspaces reutilizables para reducir la presión sobre el GC.
 * Al ser un 'object' de Kotlin, se garantiza una única instancia en toda la aplicación.
 */
object WorkspaceManager {

  private val TAG = ModuleLogger.createTag("WorkspaceManager")

  private fun kv(vararg pairs: Pair<String, Any?>) =
    pairs.joinToString(" ") { (k, v) -> "$k=$v" }

  // Instancias únicas y reutilizables de los workspaces.
  private val segmentationWorkspace = SegmentationWorkspace()
  private val classificationWorkspace = ClassificationWorkspace()

  // Un "candado" (Mutex) para cada workspace para garantizar acceso seguro.
  private val segmentationMutex = Mutex()
  private val classificationMutex = Mutex()



  suspend fun <R> useSegmentationWorkspace(block: suspend (SegmentationWorkspace) -> R): R {
    val t0 = System.nanoTime()
    logI(TAG) { "ws_use_begin " + kv("type" to "segmentation", "thread" to Thread.currentThread().name) }
    return segmentationMutex.withLock {
      segmentationWorkspace.reset()
      val result = block(segmentationWorkspace)
      val durMs = (System.nanoTime() - t0) / 1_000_000.0
      logD(TAG) { "ws_use_ok " + kv("type" to "segmentation", "ms" to String.format(Locale.US, "%.3f", durMs)) }
      result
    }
  }

  suspend fun <R> useClassificationWorkspace(block: suspend (ClassificationWorkspace) -> R): R {
    val t0 = System.nanoTime()
    logI(TAG) { "ws_use_begin " + kv("type" to "classification", "thread" to Thread.currentThread().name) }
    return classificationMutex.withLock {
      classificationWorkspace.reset()
      val result = block(classificationWorkspace)
      val durMs = (System.nanoTime() - t0) / 1_000_000.0
      logD(TAG) { "ws_use_ok " + kv("type" to "classification", "ms" to String.format(Locale.US, "%.3f", durMs)) }
      result
    }
  }
}