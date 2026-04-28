import * as FileSystem from "expo-file-system";

export type Ptr = { path: string };
export const ptr = (path: string): Ptr => ({ path });

export async function readJson<T>(p: Ptr): Promise<T> {
  const raw = await FileSystem.readAsStringAsync(p.path);
  return JSON.parse(raw) as T;
}

export async function writeJson(p: Ptr, obj: unknown): Promise<void> {
  const tmp = `${p.path}.tmp-${Date.now()}`;
  await FileSystem.writeAsStringAsync(tmp, JSON.stringify(obj));
  await FileSystem.moveAsync({ from: tmp, to: p.path });
}
