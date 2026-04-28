import type { AbsolutePixelBox } from "./types";

function _sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

function _calculateIoU(box1: AbsolutePixelBox, box2: AbsolutePixelBox): number {
  const xA = Math.max(box1.x1, box2.x1);
  const yA = Math.max(box1.y1, box2.y1);
  const xB = Math.min(box1.x2, box2.x2);
  const yB = Math.min(box1.y2, box2.y2);

  const interArea = Math.max(0, xB - xA) * Math.max(0, yB - yA);
  const box1Area = (box1.x2 - box1.x1) * (box1.y2 - box1.y1);
  const box2Area = (box2.x2 - box2.x1) * (box2.y2 - box2.y1);
  const unionArea = box1Area + box2Area - interArea;

  return unionArea > 0 ? interArea / unionArea : 0;
}

function _clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// Exportaciones del módulo mathUtils
// biome-ignore format: true
export {
  _sigmoid as sigmoid,
  _calculateIoU as calculateIoU,
  _clamp as clamp,
};
