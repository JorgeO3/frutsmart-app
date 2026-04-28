import * as FileSystem from "expo-file-system";
import { AppError } from "@src/minikit/core/ErrorTaxonomy";

export async function writeAtomicText(finalPath: string, text: string) {
  const tmp = `${finalPath}.tmp-${Date.now()}`;
  const dir = finalPath.slice(0, finalPath.lastIndexOf("/"));
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(
    () => {},
  );
  await FileSystem.writeAsStringAsync(tmp, text);
  await FileSystem.moveAsync({ from: tmp, to: finalPath });
}

export async function writeAtomicBase64(finalPath: string, base64: string) {
  const tmp = `${finalPath}.tmp-${Date.now()}`;
  const dir = finalPath.slice(0, finalPath.lastIndexOf("/"));
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(
    () => {},
  );
  await FileSystem.writeAsStringAsync(tmp, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  await FileSystem.moveAsync({ from: tmp, to: finalPath });
}

export async function moveAtomic(from: string, to: string) {
  try {
    await FileSystem.moveAsync({ from, to });
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    if (/EXDEV|cross-device/i.test(msg)) {
      await FileSystem.copyAsync({ from, to });
      await FileSystem.deleteAsync(from, { idempotent: true }).catch(() => {});
    } else {
      throw new AppError(
        "E_FS_IO",
        `moveAtomic failed: ${msg}`,
        "FileOps.moveAtomic",
        e,
      );
    }
  }
}

export async function copyAtomic(from: string, to: string) {
  try {
    await FileSystem.copyAsync({ from, to });
  } catch (e) {
    throw new AppError(
      "E_FS_IO",
      "copyAtomic failed",
      "FileOps.copyAtomic",
      e,
      { from, to },
    );
  }
}

export async function rmrf(path: string) {
  try {
    await FileSystem.deleteAsync(path, { idempotent: true });
  } catch {}
}
