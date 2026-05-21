import { Image } from "react-native";

import * as FileSystem from "expo-file-system/legacy";
import * as IM from "expo-image-manipulator";

const { ImageManipulator, SaveFormat } = IM;

const getSize = (uri: string) =>
  new Promise<{ width: number; height: number }>((resolve, reject) => {
    Image.getSize(uri, (width, height) => resolve({ width, height }), reject);
  });

export async function resizeToWebp(
  srcUri: string,
  destUri: string,
  maxLongEdge = 2560,
  quality = 0.95
): Promise<void> {
  const { width, height } = await getSize(srcUri);
  const landscape = width >= height;

  const ctx = ImageManipulator.manipulate(srcUri);
  let img: IM.ImageRef | null = null;
  try {
    ctx.resize(landscape ? { width: maxLongEdge } : { height: maxLongEdge });
    img = await ctx.renderAsync();

    const out = await img.saveAsync({
      format: SaveFormat.WEBP,
      compress: quality,
    });

    await FileSystem.moveAsync({ from: out.uri, to: destUri });
  } finally {
    img?.release?.();
    ctx.release?.();
  }
}