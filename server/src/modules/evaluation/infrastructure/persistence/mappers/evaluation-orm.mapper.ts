import { Injectable } from "@nestjs/common";
import { ClassificationResult } from "../../../domain/entities/classification-result.entity";
import { ClassificationStep } from "../../../domain/entities/classification-step.entity";
import { ClassifiedSegment } from "../../../domain/entities/classified-segment.entity";
import { Evaluation } from "../../../domain/entities/evaluation.entity";
import { Photo } from "../../../domain/entities/photo.entity";
import {
	ClassificationKind,
	EvaluationType,
	PhotoRole,
	ProviderKind,
	TimeOfDay,
} from "../../../domain/types";
import { Geolocation } from "../../../domain/value-objects/geolocation.vo";
import { HarvestCriteria } from "../../../domain/value-objects/harvest-criteria.vo";
import { Traceability } from "../../../domain/value-objects/traceability.vo";
import { ClassificationResultOrmEntity } from "../entities/classification-result.orm-entity";
import { ClassificationStepOrmEntity } from "../entities/classification-step.orm-entity";
import { ClassifiedSegmentOrmEntity } from "../entities/classified-segment.orm-entity";
import { EvaluationOrmEntity } from "../entities/evaluation.orm-entity";
import { PhotoOrmEntity } from "../entities/photo.orm-entity";
import { IEvaluationOrmMapper } from "./evaluation-orm.mapper.port";

/**
 * Mapper between domain entities and TypeORM entities.
 */
@Injectable()
export class EvaluationOrmMapper implements IEvaluationOrmMapper {
	/**
	 * Map TypeORM entity to domain aggregate.
	 */
	toDomain(orm: EvaluationOrmEntity): Evaluation {
		// Reconstruct Value Objects
		const traceability = Traceability.create({
			type: orm.type as EvaluationType,
			providerKind: orm.providerKind as ProviderKind | undefined,
			programId: orm.programId ?? undefined,
			lotId: orm.lotId ?? undefined,
			centerId: orm.centerId ?? undefined,
			providerId: orm.providerId ?? undefined,
			truckPlate: orm.truckPlate ?? undefined,
		});

		const geolocation = Geolocation.create(
			orm.geoLatitude ?? undefined,
			orm.geoLongitude ?? undefined,
		);

		const harvestCriteria = HarvestCriteria.from(
			orm.harvestCriteriaJson ?? undefined,
		);

		// Create aggregate root
		const evaluation = Evaluation.create({
			id: orm.id,
			type: orm.type as EvaluationType,
			creationTimestamp: orm.creationTimestamp,
			truckPlate: orm.truckPlate,
			traceability,
			geolocation,
			harvestCriteria,
			uploadSessionId: orm.uploadSessionId ?? undefined,
			qrCode: orm.qrCode ?? undefined,
			consecutiveNumber: orm.consecutiveNumber ?? undefined,
			deviceWeather: orm.deviceWeather ?? undefined,
			harvestObservation: orm.harvestObservation ?? undefined,
			subProviderId: orm.subProviderId ?? undefined,
			deviceTimeOfDay: orm.deviceTimeOfDay,
			deviceHasInternet: orm.deviceHasInternet ?? undefined,
			modelDetectionId: orm.modelDetectionId ?? undefined,
			modelExternalId: orm.modelExternalId ?? undefined,
			modelInternalId: orm.modelInternalId ?? undefined,
			createdAt: orm.createdAt,
		});

		// Add steps
		for (const stepOrm of orm.steps ?? []) {
			const step = this.stepToDomain(stepOrm);
			evaluation.addStep(step);
		}

		// Restore finalized state
		if (orm.isFinalized) {
			evaluation.finalize();
		}

		return evaluation;
	}

	/**
	 * Map ClassificationStepOrmEntity to domain entity.
	 */
	private stepToDomain(orm: ClassificationStepOrmEntity): ClassificationStep {
		const step = ClassificationStep.create({
			id: orm.id,
			evaluationId: orm.evaluationId,
			kind: orm.kind as ClassificationKind,
			iterationIndex: orm.iterationIndex,
			createdAt: orm.createdAt,
		});

		// Set result if present
		if (orm.result) {
			const result = this.resultToDomain(orm.result);
			step.setResult(result);
		}

		// Add photos
		for (const photoOrm of orm.photos ?? []) {
			const photo = this.photoToDomain(photoOrm);
			step.addPhoto(photo);
		}

		// Add segments
		for (const segmentOrm of orm.segments ?? []) {
			const segment = this.segmentToDomain(segmentOrm);
			step.addSegment(segment);
		}

		return step;
	}

	/**
	 * Map ClassificationResultOrmEntity to domain entity.
	 */
	private resultToDomain(
		orm: ClassificationResultOrmEntity,
	): ClassificationResult {
		return ClassificationResult.create({
			id: orm.id,
			stepId: orm.stepId,
			aiClassName: orm.aiClassName ?? undefined,
			aiConfidence: orm.aiConfidence ?? undefined,
			aiRawConfidencesJson: orm.aiRawConfidencesJson ?? undefined,
			hfIsCorrect: orm.hfIsCorrect ?? undefined,
			hfCorrectedClassName: orm.hfCorrectedClassName ?? undefined,
			hfObservation: orm.hfObservation ?? undefined,
			createdAt: orm.createdAt,
		});
	}

	/**
	 * Map PhotoOrmEntity to domain entity.
	 */
	private photoToDomain(orm: PhotoOrmEntity): Photo {
		return Photo.create({
			id: orm.id,
			stepId: orm.stepId,
			role: orm.role as PhotoRole,
			uploadItemId: orm.uploadItemId ?? undefined,
			createdAt: orm.createdAt,
		});
	}

	/**
	 * Map ClassifiedSegmentOrmEntity to domain entity.
	 */
	private segmentToDomain(orm: ClassifiedSegmentOrmEntity): ClassifiedSegment {
		return ClassifiedSegment.create({
			id: orm.id,
			stepId: orm.stepId,
			uploadItemId: orm.uploadItemId ?? undefined,
			bestClassName: orm.bestClassName,
			bestConfidence: orm.bestConfidence,
			confidencesJson: orm.confidencesJson,
			createdAt: orm.createdAt,
		});
	}

	/**
	 * Map domain aggregate to TypeORM entity (for persistence).
	 */
	toPersistence(domain: Evaluation): EvaluationOrmEntity {
		const orm = new EvaluationOrmEntity();
		orm.id = domain.id;
		orm.uploadSessionId = domain.uploadSessionId ?? null;
		orm.type = domain.type;
		orm.creationTimestamp = domain.creationTimestamp;
		orm.isFinalized = domain.isFinalized;
		orm.qrCode = domain.qrCode ?? null;
		orm.providerKind = domain.traceability.providerKind ?? null;
		orm.truckPlate = domain.traceability.truckPlate;
		orm.consecutiveNumber = domain.consecutiveNumber ?? null;
		orm.providerId = domain.traceability.providerId ?? null;
		orm.subProviderId = domain.subProviderId ?? null;
		orm.programId = domain.traceability.programId ?? null;
		orm.lotId = domain.traceability.lotId ?? null;
		orm.centerId = domain.traceability.centerId ?? null;
		orm.deviceTimeOfDay = domain.deviceTimeOfDay ?? null;
		orm.deviceWeather = domain.deviceWeather ?? null;
		orm.deviceHasInternet = domain.deviceHasInternet ?? null;
		orm.geoLatitude = domain.geolocation.latitude ?? null;
		orm.geoLongitude = domain.geolocation.longitude ?? null;
		orm.harvestCriteriaJson = domain.harvestCriteria.value;
		orm.harvestObservation = domain.harvestObservation ?? null;
		orm.modelDetectionId = domain.modelDetectionId ?? null;
		orm.modelExternalId = domain.modelExternalId ?? null;
		orm.modelInternalId = domain.modelInternalId ?? null;
		orm.createdAt = domain.createdAt ?? new Date();

		// Map steps
		orm.steps = domain.steps.map((step) => this.stepToPersistence(step));

		return orm;
	}

	/**
	 * Map ClassificationStep domain entity to ORM entity.
	 */
	private stepToPersistence(
		domain: ClassificationStep,
	): ClassificationStepOrmEntity {
		const orm = new ClassificationStepOrmEntity();
		orm.id = domain.id;
		orm.evaluationId = domain.evaluationId;
		orm.kind = domain.kind;
		orm.iterationIndex = domain.iterationIndex;
		orm.createdAt = domain.createdAt ?? new Date();

		// Map result
		if (domain.result) {
			orm.result = this.resultToPersistence(domain.result);
		}

		// Map photos
		orm.photos = Array.from(domain.photos).map((photo) =>
			this.photoToPersistence(photo),
		);

		// Map segments
		orm.segments = Array.from(domain.segments).map((segment) =>
			this.segmentToPersistence(segment),
		);

		return orm;
	}

	/**
	 * Map ClassificationResult domain entity to ORM entity.
	 */
	private resultToPersistence(
		domain: ClassificationResult,
	): ClassificationResultOrmEntity {
		const orm = new ClassificationResultOrmEntity();
		orm.id = domain.id;
		orm.stepId = domain.stepId;
		orm.aiClassName = domain.aiClassName ?? null;
		orm.aiConfidence = domain.aiConfidence ?? null;
		orm.aiRawConfidencesJson = domain.aiRawConfidencesJson ?? null;
		orm.hfIsCorrect = domain.hfIsCorrect ?? null;
		orm.hfCorrectedClassName = domain.hfCorrectedClassName ?? null;
		orm.hfObservation = domain.hfObservation ?? null;
		orm.createdAt = domain.createdAt ?? new Date();
		return orm;
	}

	/**
	 * Map Photo domain entity to ORM entity.
	 */
	private photoToPersistence(domain: Photo): PhotoOrmEntity {
		const orm = new PhotoOrmEntity();
		orm.id = domain.id;
		orm.stepId = domain.stepId;
		orm.role = domain.role;
		orm.uploadItemId = domain.uploadItemId ?? null;
		orm.createdAt = domain.createdAt ?? new Date();
		return orm;
	}

	/**
	 * Map ClassifiedSegment domain entity to ORM entity.
	 */
	private segmentToPersistence(
		domain: ClassifiedSegment,
	): ClassifiedSegmentOrmEntity {
		const orm = new ClassifiedSegmentOrmEntity();
		orm.id = domain.id;
		orm.stepId = domain.stepId;
		orm.uploadItemId = domain.uploadItemId ?? null;
		orm.bestClassName = domain.bestClassName;
		orm.bestConfidence = domain.bestConfidence;
		orm.confidencesJson = domain.confidencesJson;
		orm.createdAt = domain.createdAt ?? new Date();
		return orm;
	}
}
