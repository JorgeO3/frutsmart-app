import { tempFileManager } from "@services/temp-file-manager/TempFileManager";
import { PHOTO_CAPTURE_BUDGET } from "@src/constants/spaceBudgets";
import { resizeToWebp } from "@utils/resizeToWebp";
import { getFreeBytes } from "@utils/storage";
import * as FileSystem from "expo-file-system/legacy";

export async function compactExternalRawToTmp(
  srcUri: string,
  maxLongEdge = 2560,
  quality = 0.95,
): Promise<string> {
  const free = await getFreeBytes();
  if (free < PHOTO_CAPTURE_BUDGET) {
    throw new Error(
      `Espacio insuficiente: necesita al menos ${(PHOTO_CAPTURE_BUDGET / 1024 / 1024).toFixed(0)} MB libres para procesar la imagen.`
    );
  }

  // Destino en tu TMP (se borra al reiniciar sesión)
  const dst = tempFileManager.getNewTempFileUri(".webp");

  try {
    await resizeToWebp(srcUri, dst, maxLongEdge, quality);
    return dst;
  } catch (e) {
    console.warn("[Detection] Fallback compact → copy original:", e);
    // Si falla la manipulación, al menos copia el original
    await FileSystem.copyAsync({ from: srcUri, to: dst });
    return dst;
  }
}
