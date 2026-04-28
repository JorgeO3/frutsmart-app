import { File } from "expo-file-system/next";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

import ImageUtils from "@/modules/img-utils";

import type { AbsolutePixelBox, Segment } from "./types";

import * as MathUtils from "./mathUtils";

interface PreprocessImageOptions {
  // Tipo interno para opciones de preprocessImage
  targetSize: number;
  isBgr?: boolean;
  outputFormat?: SaveFormat;
}

interface CropParameters {
  // Tipo interno para parámetros de recorte
  originX: number;
  originY: number;
  width: number;
  height: number;
}

function _convertPixelsToTensorBuffer(
  pixelBytes: Uint8Array,
  isBgr: boolean,
): Float32Array {
  const numPixels = pixelBytes.length / 4;
  const tensorBuffer = new Float32Array(numPixels * 3);
  let tensorWriteIdx = 0;

  for (let i = 0; i < pixelBytes.length; i += 4) {
    const r = pixelBytes[i + 0] / 255.0;
    const g = pixelBytes[i + 1] / 255.0;
    const b = pixelBytes[i + 2] / 255.0;
    if (isBgr) {
      tensorBuffer[tensorWriteIdx++] = b;
      tensorBuffer[tensorWriteIdx++] = g;
      tensorBuffer[tensorWriteIdx++] = r;
    } else {
      tensorBuffer[tensorWriteIdx++] = r;
      tensorBuffer[tensorWriteIdx++] = g;
      tensorBuffer[tensorWriteIdx++] = b;
    }
  }
  return tensorBuffer;
}

async function _preprocessImage(
  sourceImageUri: string,
  options: PreprocessImageOptions,
): Promise<{ uri: string; pixelBuffer: Float32Array }> {
  const { targetSize, isBgr = false, outputFormat = SaveFormat.JPEG } = options;

  console.log({ sourceImageUri, targetSize, isBgr, outputFormat });
  const manipulateCtx = ImageManipulator.manipulate(sourceImageUri);
  manipulateCtx.resize({ width: targetSize, height: targetSize });
  const renderedImageRef = await manipulateCtx.renderAsync();
  const manipResult = await renderedImageRef.saveAsync({
    format: outputFormat,
    compress: 1,
  });

  const decodedInfo = await ImageUtils.decodeJpegAsync(manipResult.uri);
  const file = new File(decodedInfo.uri);
  const pixelBytesRaw = file.bytes();
  const pixelBuffer = _convertPixelsToTensorBuffer(pixelBytesRaw, isBgr);

  return { uri: manipResult.uri, pixelBuffer };
}

function _calculateImageCropParameters(
  absoluteBox: AbsolutePixelBox,
  imageWidth: number,
  imageHeight: number,
): CropParameters | null {
  const cropX = MathUtils.clamp(Math.floor(absoluteBox.x1), 0, imageWidth - 1);
  const cropY = MathUtils.clamp(Math.floor(absoluteBox.y1), 0, imageHeight - 1);
  const prelimWidth = Math.floor(absoluteBox.x2 - absoluteBox.x1);
  const prelimHeight = Math.floor(absoluteBox.y2 - absoluteBox.y1);
  const cropW = Math.max(1, Math.min(prelimWidth, imageWidth - cropX));
  const cropH = Math.max(1, Math.min(prelimHeight, imageHeight - cropY));

  if (cropW <= 0 || cropH <= 0) {
    console.warn(
      "_calculateImageCropParameters: Dimensiones de recorte calculadas (w,h) son <= 0.",
    );
    return null;
  }
  return { originX: cropX, originY: cropY, width: cropW, height: cropH };
}

async function _cropObjectFromSegment(
  sourceImageUri: string,
  segment: Segment,
  sourceImageWidth: number,
  sourceImageHeight: number,
): Promise<string | null> {
  const cropParams = _calculateImageCropParameters(
    segment.absoluteBoxPx,
    sourceImageWidth,
    sourceImageHeight,
  );

  if (!cropParams) {
    console.log(
      "_cropObjectFromSegment: No se pudieron calcular los parámetros de recorte válidos.",
    );
    return null;
  }

  try {
    const manipulatorContext = ImageManipulator.manipulate(sourceImageUri);
    manipulatorContext.crop(cropParams);
    const croppedImageRef = await manipulatorContext.renderAsync();
    const croppedResult = await croppedImageRef.saveAsync({
      format: SaveFormat.PNG,
      compress: 1,
    });
    return croppedResult.uri;
  } catch (cropError) {
    console.error(
      "_cropObjectFromSegment: Error durante ImageManipulator.crop/save:",
      cropError,
    );
    throw new Error(
      `Fallo al recortar el segmento: ${cropError instanceof Error ? cropError.message : String(cropError)}`,
    );
  }
}

// Exportaciones del módulo imageProcessor
export {
  _preprocessImage as preprocessImage,
  _cropObjectFromSegment as cropObjectFromSegment,
};
