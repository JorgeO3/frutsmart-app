import * as FileSystem from "expo-file-system/legacy";

export type EnsureSpaceResult = { ok: true; free: number } | {
  ok: false; free: number; reason: string
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

export async function ensureSpace(
  budgetBytes: number,
): Promise<EnsureSpaceResult> {
  const free = await getFreeBytes();
  if (free >= budgetBytes) return { ok: true, free };
  return { ok: false, free, reason: "insufficient-space" };
}
