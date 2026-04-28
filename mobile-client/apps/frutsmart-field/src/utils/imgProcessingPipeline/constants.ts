export const SEGMENTATION_MODEL_CONFIG = {
  INPUT_SIZE: 640,
  CONFIDENCE_THRESHOLD: 0.25,
  IOU_NMS_THRESHOLD: 0.45,
  NUM_PROPOSALS: 8400,
  NUM_ATTRIBUTES_PER_PROPOSAL: 37,
  MASK_HEIGHT: 160,
  MASK_WIDTH: 160,
} as const;

export const CLASSIFICATION_MODEL_CONFIG = {
  INPUT_SIZE: 224,
  IS_BGR: false,
} as const;

export const INTERNAL_CLASSIFICATION_LABELS = [
  "TipoA",
  "TipoB",
  "TipoC",
  "TipoD",
] as const;

export const EXTERNAL_CLASSIFICATION_LABELS = [
  "Tipo1",
  "Tipo2",
  "Tipo3",
  "Tipo4",
] as const;
