import * as FileSystem from "expo-file-system";

export async function ensureDir(dir: string) {
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(
    () => {},
  );
}

export async function promoteDir(staging: string, finalDir: string) {
  await FileSystem.moveAsync({ from: staging, to: finalDir });
}
