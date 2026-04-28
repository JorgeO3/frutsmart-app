import { Injectable } from "@nestjs/common";
import { ClassificationResult } from "../../domain/entities/classification-result.entity";
import { ClassificationStep } from "../../domain/entities/classification-step.entity";
import { ClassifiedSegment } from "../../domain/entities/classified-segment.entity";
import { Evaluation } from "../../domain/entities/evaluation.entity";
import { Photo } from "../../domain/entities/photo.entity";
import { Geolocation } from "../../domain/value-objects/geolocation.vo";
import { HarvestCriteria } from "../../domain/value-objects/harvest-criteria.vo";
import { Traceability } from "../../domain/value-objects/traceability.vo";
import {
	CreateEvaluationInput,
	CreatePhotoInput,
	CreateResultInput,
	CreateSegmentInput,
	CreateStepInput,
} from "../dto/create-evaluation/create-evaluation.input";
import {
	CreateEvaluationOutput,
	StepSummary,
} from "../dto/create-evaluation/create-evaluation.output";
import { ICreateEvaluationMapper } from "./create-evaluation.mapper.port";

/**
 * Mapper for CreateEvaluation use case.
 * Handles conversion between domain entities and application DTOs.
 */
@Injectable()
export class CreateEvaluationMapper implements ICreateEvaluationMapper {
	/**
	 * Map input DTO to Evaluation domain aggregate (with finalization).
	 */
	toDomain(input: CreateEvaluationInput): Evaluation {
		// Create Value Objects
		const traceability = Traceability.create({
			type: input.type,
			providerKind: input.providerKind,
			programId: input.programId,
			lotId: input.lotId,
			centerId: input.centerId,
			providerId: input.providerId,
			truckPlate: input.truckPlate,
		});

		const geolocation = Geolocation.create(
			input.geoLatitude,
			input.geoLongitude,
		);

		const harvestCriteria = HarvestCriteria.from(input.harvestCriteriaJson);

		// Create aggregate root
		const evaluation = Evaluation.create({
			id: input.id,
			type: input.type,
			creationTimestamp: input.creationTimestamp,
			traceability,
			geolocation,
			harvestCriteria,
			uploadSessionId: input.uploadSessionId,
			truckPlate: input.truckPlate,
			qrCode: input.qrCode,
			consecutiveNumber: input.consecutiveNumber,
			deviceWeather: input.deviceWeather,
			harvestObservation: input.harvestObservation,
			subProviderId: input.subProviderId,
			deviceTimeOfDay: input.deviceTimeOfDay,
			deviceHasInternet: input.deviceHasInternet,
			modelDetectionId: input.modelDetectionId,
			modelExternalId: input.modelExternalId,
			modelInternalId: input.modelInternalId,
		});

		// Add steps with nested entities
		for (const stepInput of input.steps ?? []) {
			const step = this.mapStepToDomain(stepInput, input.id);
			evaluation.addStep(step);
		}

		// Finalize evaluation (one-shot flow)
		evaluation.finalize();

		return evaluation;
	}

	/**
	 * Map Step input to ClassificationStep domain entity.
	 */
	private mapStepToDomain(
		stepInput: CreateStepInput,
		evaluationId: string,
	): ClassificationStep {
		const step = ClassificationStep.create({
			id: stepInput.id,
			evaluationId,
			kind: stepInput.kind,
			iterationIndex: stepInput.iterationIndex,
		});

		// Set result if present
		if (stepInput.result) {
			const result = this.mapResultToDomain(stepInput.result, stepInput.id);
			step.setResult(result);
		}

		// Add photos
		for (const photoInput of stepInput.photos ?? []) {
			const photo = this.mapPhotoToDomain(photoInput, stepInput.id);
			step.addPhoto(photo);
		}

		// Add segments
		for (const segmentInput of stepInput.segments ?? []) {
			const segment = this.mapSegmentToDomain(segmentInput, stepInput.id);
			step.addSegment(segment);
		}

		return step;
	}

	/**
	 * Map Result input to ClassificationResult domain entity.
	 */
	private mapResultToDomain(
		resultInput: CreateResultInput,
		stepId: string,
	): ClassificationResult {
		return ClassificationResult.create({
			id: resultInput.id,
			stepId,
			aiClassName: resultInput.aiClassName,
			aiConfidence: resultInput.aiConfidence,
			aiRawConfidencesJson: resultInput.aiRawConfidencesJson,
			hfIsCorrect: resultInput.hfIsCorrect,
			hfCorrectedClassName: resultInput.hfCorrectedClassName,
			hfObservation: resultInput.hfObservation,
		});
	}

	/**
	 * Map Photo input to Photo domain entity.
	 */
	private mapPhotoToDomain(
		photoInput: CreatePhotoInput,
		stepId: string,
	): Photo {
		return Photo.create({
			id: photoInput.id,
			stepId,
			role: photoInput.role,
			uploadItemId: photoInput.uploadItemId,
		});
	}

	/**
	 * Map Segment input to ClassifiedSegment domain entity.
	 */
	private mapSegmentToDomain(
		segmentInput: CreateSegmentInput,
		stepId: string,
	): ClassifiedSegment {
		return ClassifiedSegment.create({
			stepId,
			id: segmentInput.id,
			uploadItemId: segmentInput.uploadItemId,
			bestClassName: segmentInput.bestClassName,
			bestConfidence: segmentInput.bestConfidence,
			confidencesJson: segmentInput.confidencesJson,
		});
	}

	/**
	 * Map Evaluation domain entity to output DTO.
	 */
	toOutput(evaluation: Evaluation): CreateEvaluationOutput {
		const stepsSummary: StepSummary[] = evaluation.steps.map((step) => ({
			kind: step.kind,
			iterationIndex: step.iterationIndex,
			hasResult: step.result !== undefined,
			photoCount: step.photos.length,
			segmentCount: step.segments.length,
		}));

		const totalPhotos = evaluation.steps.reduce(
			(sum, step) => sum + step.photos.length,
			0,
		);
		const totalSegments = evaluation.steps.reduce(
			(sum, step) => sum + step.segments.length,
			0,
		);

		return {
			id: evaluation.id,
			type: evaluation.type,
			isFinalized: evaluation.isFinalized,
			createdAt: evaluation.createdAt ?? new Date(),
			totalSteps: evaluation.steps.length,
			totalPhotos,
			totalSegments,
			stepsSummary,
		};
	}
}
