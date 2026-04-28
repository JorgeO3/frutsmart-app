import {
	ClassificationKind,
	EvaluationType,
	PhotoRole,
	ProviderKind,
	TimeOfDay,
	UUID,
} from "../../../domain/types";

/**
 * Input DTO for CreateEvaluation use case (application layer).
 * No decorators - pure data structure.
 */

export interface CreateEvaluationInput {
	id: UUID;
	type: EvaluationType;
	creationTimestamp: Date;
	uploadSessionId?: UUID;
	qrCode?: string;
	consecutiveNumber: string;
	deviceWeather: string;
	harvestObservation?: string;
	providerKind?: ProviderKind;
	truckPlate: string;
	providerId?: UUID;
	subProviderId?: UUID;
	programId?: UUID;
	lotId?: UUID;
	centerId?: UUID;
	deviceTimeOfDay: TimeOfDay;
	deviceHasInternet: boolean;
	geoLatitude: number;
	geoLongitude: number;
	harvestCriteriaJson?: Record<string, unknown>;
	modelDetectionId?: UUID;
	modelExternalId?: UUID;
	modelInternalId?: UUID;
	steps?: CreateStepInput[];
}

export interface CreateStepInput {
	id: UUID;
	kind: ClassificationKind;
	iterationIndex: number;
	result?: CreateResultInput;
	photos?: CreatePhotoInput[];
	segments?: CreateSegmentInput[];
}

export interface CreateResultInput {
	id: UUID;
	aiClassName: string;
	aiConfidence: number;
	aiRawConfidencesJson: Record<string, number>;
	hfIsCorrect?: boolean;
	hfCorrectedClassName?: string;
	hfObservation?: string;
}

export interface CreatePhotoInput {
	id: UUID;
	role: PhotoRole;
	uploadItemId: UUID;
}

export interface CreateSegmentInput {
	id: UUID;
	uploadItemId: UUID;
	bestClassName: string;
	bestConfidence: number;
	confidencesJson: Record<string, number>;
}
