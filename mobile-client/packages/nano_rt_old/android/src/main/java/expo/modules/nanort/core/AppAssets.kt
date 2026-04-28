package expo.modules.nanort.core

import android.content.Context

import java.io.File
import java.io.IOException
import java.io.FileOutputStream

import expo.modules.nanort.core.logE
import expo.modules.nanort.core.ModuleLogger


/**
 * Singleton to manage access to application assets.
 * It is initialized only once to prevent context leaks.
 */
object AppAssets {

  // Standard tag for logs from this component.
  private val TAG = ModuleLogger.createTag("AppAssets")

  private lateinit var applicationContext: Context

  /**
   * Provides access to the application context.
   * Useful for components that need a context but should not retain an Activity's context.
   * @return The application context.
   * @throws IllegalStateException if init() has not been called.
   */
  fun getContext(): Context {
    if (!::applicationContext.isInitialized) {
      throw IllegalStateException("AppAssets.init() has not been called.")
    }
    return applicationContext
  }


  /**
   * Must be called only once from the Application class when the app starts.
   */
  fun init(context: Context) {
    // We use the application context to avoid memory leaks
    // tied to the lifecycle of an Activity.
    this.applicationContext = context.applicationContext
  }

  /**
   * Copies an asset from the 'assets' folder to the app's internal cache
   * (if it doesn't already exist) and returns its absolute path.
   *
   * @param assetName The name of the file in the 'assets' folder.
   * @return The absolute path to the file in the cache.
   */
  fun getAssetPath(assetName: String): String {
    // Ensure that init() has been called.
    if (!::applicationContext.isInitialized) {
      throw IllegalStateException("AppAssets.init() has not been called. Call it in your Application class.")
    }

    val file = File(applicationContext.cacheDir, assetName)

    if (!file.exists()) {
      try {
        file.parentFile?.mkdirs()
        applicationContext.assets.open(assetName).use { input ->
          FileOutputStream(file).use { output ->
            input.copyTo(output)
          }
        }
      } catch (e: IOException) {
        // Replaced the Log.e call with our centralized utility.
        logE(TAG, e) { "Fatal error: Could not find or copy asset '$assetName'." }
        throw RuntimeException("Could not find or copy asset: $assetName", e)
      }
    }
    return file.absolutePath
  }
}
