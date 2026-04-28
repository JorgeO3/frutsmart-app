import {
	ClassificationKind,
	EvaluationType,
	UUID,
} from "../../../domain/types";

/**
 * Output DTO for CreateEvaluation use case (application layer).
 * No decorators - pure data structure.
 */

export interface CreateEvaluationOutput {
	id: UUID;
	type: EvaluationType;
	isFinalized: boolean;
	createdAt: Date;
	totalSteps: number;
	totalPhotos: number;
	totalSegments: number;
	stepsSummary: StepSummary[];
}

export interface StepSummary {
	kind: ClassificationKind;
	iterationIndex: number;
	hasResult: boolean;
	photoCount: number;
	segmentCount: number;
}
