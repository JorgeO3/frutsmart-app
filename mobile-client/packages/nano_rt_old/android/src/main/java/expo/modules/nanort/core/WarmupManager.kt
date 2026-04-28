package expo.modules.nanort.core

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Gestiona el estado del pre-calentamiento de la IA para la UI.
 */
object WarmupManager {
  private val _isWarmupComplete = MutableStateFlow(false)
  val isWarmupComplete = _isWarmupComplete.asStateFlow()

  fun onWarmupFinished() {
    _isWarmupComplete.value = true
  }
}