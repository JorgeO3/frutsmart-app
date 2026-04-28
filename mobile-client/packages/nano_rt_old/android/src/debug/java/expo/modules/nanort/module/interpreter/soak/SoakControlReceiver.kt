package expo.modules.nanort.module.interpreter.soak

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.content.ContextCompat

class SoakControlReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    when (intent.action) {
      SoakControl.ACTION_START -> {
        val startIntent = Intent(context, SoakRunnerService::class.java).apply {
          action = SoakControl.ACTION_START
          putExtras(intent)
        }
        ContextCompat.startForegroundService(context, startIntent)
      }

      SoakControl.ACTION_STOP -> {
        val stopIntent = Intent(context, SoakRunnerService::class.java).apply {
          action = SoakControl.ACTION_STOP
        }
        context.startService(stopIntent)
      }
    }
  }
}
