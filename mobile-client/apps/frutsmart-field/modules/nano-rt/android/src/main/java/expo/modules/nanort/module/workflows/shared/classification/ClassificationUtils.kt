package expo.modules.nanort.module.workflows.shared.classification

import expo.modules.nanort.core.ModuleLogger
import expo.modules.nanort.core.logD
import expo.modules.nanort.core.logE
import expo.modules.nanort.core.logW
import java.util.Locale

data class ClassificationResult(val confidences: FloatArray) {
  override fun equals(other: Any?): Boolean {
    if (this === other) return true
    if (javaClass != other?.javaClass) return false

    other as ClassificationResult

    return confidences.contentEquals(other.confidences)
  }

  override fun hashCode(): Int {
    return confidences.contentHashCode()
  }
}

data class ClassificationConfig(
  val labels: List<String> = emptyList()
)

object ClassificationConfigs {
  val External = ClassificationConfig(listOf("Clase1", "Clase2", "Clase3", "Clase4"))
  val Internal = ClassificationConfig(listOf("TipoA", "TipoB", "TipoC", "TipoD"))
}