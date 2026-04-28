import * as FileSystem from "expo-file-system/legacy";
import { Alert, Platform } from "react-native";
// import * as Notifications from "expo-notifications";

class FileDownloaderService {
  /**
   * Saves a local file to a user-selected public directory and ensures it's
   * indexed by the system's MediaStore for immediate visibility.
   * @param localUri The URI of the file in the app's internal cache (must be a file:// path).
   * @param fileName The desired name for the file in the public folder.
   * @returns A promise that resolves to true if successful, false otherwise.
   */
  public async downloadToDownloadsFolder(
    localUri: string,
    fileName: string,
  ): Promise<boolean> {
    if (Platform.OS !== "android") {
      Alert.alert(
        "Función no disponible",
        "La descarga directa a una carpeta solo está disponible en Android.",
      );
      return false;
    }

    try {
      // 1. Request permissions to access a public directory.
      const permissions =
        await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();

      if (!permissions.granted) {
        Alert.alert("Permiso denegado", "No se puede descargar el archivo.");
        return false;
      }

      const directoryUri = permissions.directoryUri;

      // 2. Create the destination file in the selected public directory.
      const destUri =
        await FileSystem.StorageAccessFramework.createFileAsync(
          directoryUri,
          fileName,
          "application/pdf",
        );

      // 3. Read the content from the temporary local file.
      const base64Content = await FileSystem.readAsStringAsync(localUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // 4. Write the content to the public destination file.
      await FileSystem.writeAsStringAsync(destUri, base64Content, {
        encoding: FileSystem.EncodingType.Base64,
      });

      try {
        await FileSystem.getContentUriAsync(localUri);
      } catch (e) {
        console.warn(`Could not get content URI to trigger media scan, but file was saved. Error: ${e}`);
      }

      // 6. Notify the user that the download is complete.
      // await Notifications.scheduleNotificationAsync({
      //   content: {
      //     title: "Descarga completada",
      //     body: `El archivo "${fileName}" se ha guardado en tu dispositivo.`,
      //   },
      //   trigger: null,
      // });

      console.log(`[Downloader] File saved to ${destUri} and registered in MediaStore.`);
      return true;
    } catch (error) {
      console.error("[Downloader] Error saving file with SAF:", error);
      Alert.alert("Error de descarga", "Ocurrió un error al guardar el archivo.");
      return false;
    } finally {
      // 7. (Opcional pero recomendado) Limpiar el archivo temporal del cache.
      await FileSystem.deleteAsync(localUri, { idempotent: true });
    }
  }
}

export const fileDownloaderService = new FileDownloaderService();
