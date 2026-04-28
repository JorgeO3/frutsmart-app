import { tempFileManager } from "@services/temp-file-manager/TempFileManager";
import { PHOTO_CAPTURE_BUDGET } from "@src/constants/spaceBudgets";
import { resizeToWebp } from "@utils/resizeToWebp";
import { ensureSpace } from "@utils/storage";
import * as FileSystem from "expo-file-system/legacy";

export async function compactExternalRawToTmp(
  srcUri: string,
  maxLongEdge = 2560,
  quality = 0.95,
): Promise<string> {
  // Asegura algo de espacio y limpia TMP si hace falta
  await ensureSpace(PHOTO_CAPTURE_BUDGET, {
    tempDirUri: tempFileManager.getTempDirUri(),
    tryCleanup: true,
  });

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
