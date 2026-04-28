import { File, Paths } from "expo-file-system/next";

import ImageUtils from "@/modules/img-utils";

import type { Segment } from "./types";

async function _applySegmentationMask(
  segment: Segment,
  baseImageUri: string,
  protoWidth: number,
  protoHeight: number,
): Promise<string> {
  const maskFloat32Data = segment.lowResMaskWithSigmoid;
  if (!maskFloat32Data || maskFloat32Data.length === 0) {
    throw new Error(
      "SegmentationMaskHandler: Datos de máscara inválidos o vacíos al intentar aplicar máscara.",
    );
  }
  const maskBytes = new Uint8Array(maskFloat32Data.buffer);
  const maskFile = new File(
    Paths.cache,
    `segmentation_mask_raw_${Date.now()}.f32mask`,
  );
  maskFile.write(maskBytes);

  try {
    const result = await ImageUtils.applySegmentationMaskAsync(
      baseImageUri,
      maskFile.uri,
      protoWidth,
      protoHeight,
    );
    return result.uri;
  } catch (error) {
    console.error(
      "SegmentationMaskHandler: Error durante ImageUtils.applySegmentationMaskAsync:",
      error,
    );
    throw new Error(
      `Fallo al aplicar la máscara de segmentación: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

// Exportaciones del módulo segmentationMaskHandler
// biome-ignore format: true
export {
  _applySegmentationMask as applyMask,
};
