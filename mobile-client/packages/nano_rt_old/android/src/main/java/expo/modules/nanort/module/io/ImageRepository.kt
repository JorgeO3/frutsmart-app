package expo.modules.nanort.module.io

import android.graphics.Bitmap
import android.net.Uri


interface ImageRepository {
  suspend fun getImageFromUri(uri: Uri): Bitmap


  // Compañero para actuar como un Singleton simple para el acceso manual
  companion object {
    @Volatile
    private var INSTANCE: ImageRepository? = null

    fun getInstance(): ImageRepository {
      return INSTANCE ?: synchronized(this) {
        // La implementación real se crearía aquí o se inyectaría.
        // Por ahora, asumimos que se crea en MyApplication o similar.
        INSTANCE ?: throw IllegalStateException("ImageRepository no ha sido inicializado.")
      }
    }

    // Este método sería llamado desde MyApplication.kt
    fun initialize(repository: ImageRepository) {
      if (INSTANCE == null) {
        INSTANCE = repository
      }
    }
  }
}