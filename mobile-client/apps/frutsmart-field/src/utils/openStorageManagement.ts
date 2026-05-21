import * as Application from "expo-application";
import * as IntentLauncher from "expo-intent-launcher";
import { Linking, Platform } from "react-native";

/**
 * Abre la pantalla del SO para liberar espacio.
 * - Android: primero la ficha de detalles de la app (borrar caché/datos),
 *   luego intenta la pantalla de almacenamiento del dispositivo.
 * - iOS: abre Ajustes de la app (no hay deep link a “Almacenamiento” del sistema).
 */
export async function openStorageManagement(): Promise<void> {
  if (Platform.OS === "android") {
    // 1) Ficha de la app (permite borrar caché/datos)
    try {
      await IntentLauncher.startActivityAsync(
        IntentLauncher.ActivityAction.APPLICATION_DETAILS_SETTINGS,
        { data: `package:${Application.applicationId}` }
      );
      return;
    } catch { }

    // 2) Pantalla general de almacenamiento (fallback)
    try {
      // Algunos dispositivos soportan esta acción
      await IntentLauncher.startActivityAsync(
        "android.settings.INTERNAL_STORAGE_SETTINGS"
      );
      return;
    } catch { }

    // 3) Último fallback: ajustes generales
    try {
      await IntentLauncher.startActivityAsync(
        IntentLauncher.ActivityAction.SETTINGS
      );
      return;
    } catch { }
  } else {
    // iOS: abre Ajustes de la app
    await Linking.openSettings();
  }
}
