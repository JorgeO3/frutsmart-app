import * as FileSystem from "expo-file-system/legacy";

export type EnsureSpaceResult = { ok: true; free: number } | {
  ok: false; free: number; triedCleanup: boolean; reason: string
};

export async function getFreeBytes(): Promise<number> {
  // Expo SDK 53: estos métodos están disponibles
  const free = await FileSystem.getFreeDiskStorageAsync(); // bytes libres
  return free ?? 0;
}
export async function getTotalBytes(): Promise<number> {
  const total = await FileSystem.getTotalDiskCapacityAsync(); // bytes totales
  return total ?? 0;
}

// Limpieza básica de tu carpeta temporal propia
export async function cleanAppTempDir(tempDirUri: string): Promise<void> {
  try {
    const exists = await FileSystem.getInfoAsync(tempDirUri);
    if (exists.exists) {
      await FileSystem.deleteAsync(tempDirUri, { idempotent: true });
    }
    await FileSystem.makeDirectoryAsync(tempDirUri, { intermediates: true });
  } catch {/* log opcional */ }
}

export async function ensureSpace(
  budgetBytes: number,
  opts?: { tempDirUri?: string; tryCleanup?: boolean }
): Promise<EnsureSpaceResult> {
  const free0 = await getFreeBytes();
  if (free0 >= budgetBytes) return { ok: true, free: free0 };

  let tried = false;

  if (opts?.tryCleanup && opts.tempDirUri) {
    tried = true;
    await cleanAppTempDir(opts.tempDirUri);
  }
  // aquí podrías agregar otras limpiezas opcionales (thumbnails, caches HTTP, etc.)

  const free1 = await getFreeBytes();
  if (free1 >= budgetBytes) return { ok: true, free: free1 };

  return { ok: false, free: free1, triedCleanup: tried, reason: "insufficient-space" };
}
