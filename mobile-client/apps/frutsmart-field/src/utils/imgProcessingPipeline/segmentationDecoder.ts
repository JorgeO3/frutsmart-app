import type {
  Segment,
  AbsolutePixelBox,
  SegmentationPipelineConfig,
} from "./types";
import * as MathUtils from "./mathUtils";

function __extractYoloProposal(
  output0_data: Float32Array,
  proposalIndex: number,
  numProposals: number,
) {
  return {
    cx: output0_data[0 * numProposals + proposalIndex],
    cy: output0_data[1 * numProposals + proposalIndex],
    w: output0_data[2 * numProposals + proposalIndex],
    h: output0_data[3 * numProposals + proposalIndex],
    classScore: output0_data[4 * numProposals + proposalIndex],
  };
}

function __calculateYoloAbsoluteBox(
  proposal: { cx: number; cy: number; w: number; h: number },
  modelInputWidth: number,
  modelInputHeight: number,
): AbsolutePixelBox {
  return {
    x1: (proposal.cx - proposal.w / 2) * modelInputWidth,
    y1: (proposal.cy - proposal.h / 2) * modelInputHeight,
    x2: (proposal.cx + proposal.w / 2) * modelInputWidth,
    y2: (proposal.cy + proposal.h / 2) * modelInputHeight,
  };
}

function __extractYoloMaskCoefficients(
  output0_data: Float32Array,
  proposalIndex: number,
  numProposals: number,
  numMaskCoeffs: number,
): Float32Array {
  const maskCoefficients = new Float32Array(numMaskCoeffs);
  for (let k = 0; k < numMaskCoeffs; k++) {
    maskCoefficients[k] = output0_data[(5 + k) * numProposals + proposalIndex];
  }
  return maskCoefficients;
}

function __extractYoloCandidateSegments(
  output0_data: Float32Array,
  config: SegmentationPipelineConfig,
): Segment[] {
  const {
    inputSize,
    numProposals,
    numAttributesPerProposal,
    confidenceThreshold,
    maskHeight,
    maskWidth,
  } = config;
  const numMaskCoeffs = numAttributesPerProposal - 5;
  const candidateSegments: Segment[] = [];

  for (let i = 0; i < numProposals; i++) {
    const proposalData = __extractYoloProposal(output0_data, i, numProposals);
    if (proposalData.classScore < confidenceThreshold) continue;

    const absoluteBox = __calculateYoloAbsoluteBox(
      proposalData,
      inputSize,
      inputSize,
    );
    const maskCoefficients = __extractYoloMaskCoefficients(
      output0_data,
      i,
      numProposals,
      numMaskCoeffs,
    );

    candidateSegments.push({
      box: {
        x: proposalData.cx,
        y: proposalData.cy,
        width: proposalData.w,
        height: proposalData.h,
      },
      absoluteBoxPx: absoluteBox,
      score: proposalData.classScore,
      classId: 0,
      maskCoefficients,
      lowResMaskWithSigmoid: new Float32Array(maskHeight * maskWidth),
    });
  }
  return candidateSegments.sort((a, b) => b.score - a.score);
}

function __isValidYoloSegment(segment: Segment): boolean {
  const { width, height } = segment.box;
  const isValid = width > 0 && height > 0 && width <= 2.0 && height <= 2.0;
  if (!isValid) {
    console.log(
      "YoloSegmentationDecoder: Segmento con dimensiones normalizadas inválidas encontrado y filtrado:",
      segment.box,
    );
  }
  return isValid;
}

function __applyYoloNonMaximumSuppression(
  candidateSegments: Segment[],
  nmsThreshold: number,
): Segment[] {
  const finalSegments: Segment[] = [];
  let currentCandidates = [...candidateSegments];
  while (currentCandidates.length > 0) {
    const bestSegment = currentCandidates.shift();
    if (bestSegment && __isValidYoloSegment(bestSegment)) {
      finalSegments.push(bestSegment);
      currentCandidates = currentCandidates.filter((segment) => {
        const iou = MathUtils.calculateIoU(
          bestSegment.absoluteBoxPx,
          segment.absoluteBoxPx,
        );
        return iou <= nmsThreshold;
      });
    }
  }
  return finalSegments;
}

function __generateYoloMasks(
  finalSegments: Segment[],
  maskPrototypes: Float32Array,
  config: Pick<
    SegmentationPipelineConfig,
    "maskHeight" | "maskWidth" | "numAttributesPerProposal"
  >,
): void {
  const { maskHeight, maskWidth, numAttributesPerProposal } = config;
  const numMaskCoeffs = numAttributesPerProposal - 5;

  for (const segment of finalSegments) {
    const lowResMask = segment.lowResMaskWithSigmoid;
    for (let y = 0; y < maskHeight; y++) {
      for (let x = 0; x < maskWidth; x++) {
        let maskValue = 0;
        for (let k = 0; k < numMaskCoeffs; k++) {
          const protoIdx =
            y * maskWidth * numMaskCoeffs + x * numMaskCoeffs + k;
          // const protoIdx = k * maskHeight * maskWidth + y * maskWidth + x;
          maskValue += segment.maskCoefficients[k] * maskPrototypes[protoIdx];
        }
        lowResMask[y * maskWidth + x] = MathUtils.sigmoid(maskValue);
      }
    }
  }
}

function _decodeYoloSegmentationOutput(
  rawOutputs: [Float32Array, Float32Array],
  config: SegmentationPipelineConfig,
): Segment[] {
  const [output0_data, output1_maskPrototypes] = rawOutputs;
  const candidateSegmentsAboveThreshold = __extractYoloCandidateSegments(
    output0_data,
    config,
  );
  const finalSegmentsAfterNMS = __applyYoloNonMaximumSuppression(
    candidateSegmentsAboveThreshold,
    config.iouNmsThreshold,
  );

  if (finalSegmentsAfterNMS.length > 0) {
    __generateYoloMasks(finalSegmentsAfterNMS, output1_maskPrototypes, config);
  }
  return finalSegmentsAfterNMS;
}

// biome-ignore format: true
export {
  _decodeYoloSegmentationOutput as decode,
};
