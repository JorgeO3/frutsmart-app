import type { TensorflowModel } from "react-native-fast-tflite";

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type AbsolutePixelBox = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export interface Segment {
  box: BoundingBox;
  absoluteBoxPx: AbsolutePixelBox;
  score: number;
  classId: number;
  maskCoefficients: Float32Array;
  lowResMaskWithSigmoid: Float32Array;
}

export interface SegmentationPipelineConfig {
  inputSize: number;
  confidenceThreshold: number;
  iouNmsThreshold: number;
  numProposals: number;
  numAttributesPerProposal: number;
  maskHeight: number;
  maskWidth: number;
}

export interface ClassificationPipelineConfig {
  inputSize: number;
  isBgr: boolean;
  labels: readonly string[];
}

export interface SegmentationPipelineOptions {
  sourceImageUri: string;
  segmentationModel: TensorflowModel;
  segmentationInputBuffer: Float32Array;
  config: SegmentationPipelineConfig;
}

export interface ClassificationPipelineOptions {
  imgUri: string;
  model: TensorflowModel;
  inputBuffer: Float32Array;
  config: ClassificationPipelineConfig;
}

export interface SegmentationPipelineOutput {
  bestSegmentUri: string | null;
  segmentsFound: number;
}

export interface ClassificationPipelineOutput {
  output: Float32Array | null;
}
