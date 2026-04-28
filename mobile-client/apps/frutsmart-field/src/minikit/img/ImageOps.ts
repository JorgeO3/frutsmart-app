import {
  ImageManipulator,
  SaveFormat,
  type ImageManipulatorContext,
  type ImageRef,
} from "expo-image-manipulator";
import { moveAtomic } from "@src/minikit/fs/FileOps";
import { AppError } from "@src/minikit/core/ErrorTaxonomy";

export async function cropAndWebp(
  inputUri: string,
  outUri: string,
  w: number,
  h: number,
  q = 0.8,
) {
  let ctx: ImageManipulatorContext | null = null;
  let img: ImageRef | null = null;
  try {
    ctx = ImageManipulator.manipulate(inputUri);
    ctx.resize({ width: w, height: h });
    img = await ctx.renderAsync();
    const tmp = await img.saveAsync({ format: SaveFormat.WEBP, compress: q });
    await moveAtomic(tmp.uri, outUri);
  } catch (e) {
    const msg = String((e as any)?.message ?? e);
    const code = /OutOfMemory|ENOMEM|insufficient/i.test(msg)
      ? "E_IMAGE_OOM"
      : "E_IMAGE_UNSUPPORTED";
    throw new AppError(
      code as any,
      `cropAndWebp failed: ${msg}`,
      "ImageOps.cropAndWebp",
      e,
      { inputUri, outUri },
    );
  } finally {
    try {
      img?.release();
    } catch {}
    try {
      ctx?.release();
    } catch {}
  }
}
