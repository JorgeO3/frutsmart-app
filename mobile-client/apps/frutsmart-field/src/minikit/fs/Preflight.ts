import * as FileSystem from "expo-file-system";
import { AppError } from "@src/minikit/core/ErrorTaxonomy";

export async function ensureSpace(bytesNeeded: number) {
  const free = await FileSystem.getFreeDiskStorageAsync();
  if (free < bytesNeeded) {
    throw new AppError(
      "E_STORAGE_FULL",
      `Espacio insuficiente: requiere ${bytesNeeded}, libre ${free}`,
      "Preflight.ensureSpace",
    );
  }
}
