import { Image } from "react-native";

import * as FileSystem from "expo-file-system/legacy";
import * as IM from "expo-image-manipulator";

const { ImageManipulator, SaveFormat } = IM;

// helper mínimo para leer dimensiones (barato y suficiente para una pasada)
const getSize = (uri: string) =>
  new Promise<{ width: number; height: number }>((resolve, reject) => {
    Image.getSize(uri, (width, height) => resolve({ width, height }), reject);
  });

/**
 * Redimensiona para que el lado largo <= maxLongEdge y guarda en WebP (1 sola pasada).
 * Usa la API con contexto (SharedObject) y libera memoria manualmente.
 */
export async function resizeToWebp(
  srcUri: string,
  destUri: string,
  maxLongEdge = 2560,
  quality = 0.95
): Promise<void> {
  // 1) Detectar orientación para elegir una sola dimensión (mantiene aspect ratio)
  const { width, height } = await getSize(srcUri);
  const landscape = width >= height;

  // 2) Un solo contexto y un solo render → una sola compresión
  const ctx = ImageManipulator.manipulate(srcUri);
  let img: IM.ImageRef | null = null;
  try {
    ctx.resize(landscape ? { width: maxLongEdge } : { height: maxLongEdge });
    img = await ctx.renderAsync();

    const out = await img.saveAsync({
      format: SaveFormat.WEBP,
      compress: quality, // 0..1
    });

    await FileSystem.moveAsync({ from: out.uri, to: destUri });
  } finally {
    img?.release?.();
    ctx.release?.();
  }
}
