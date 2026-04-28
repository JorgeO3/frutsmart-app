// src/modules/evaluation/domain/entities/classification-step.entity.ts
import { ArgumentInvalidError } from "../errors/argument-invalid.error";
import { InvalidIterationIndexError } from "../errors/invalid-iteration-index.error";
import { ClassificationKind, UUID } from "../types";
import { ClassificationResult } from "./classification-result.entity";
import { ClassifiedSegment } from "./classified-segment.entity";
import { Photo } from "./photo.entity";

const KINDS: ClassificationKind[] = ["external", "internal"];

export class ClassificationStep {
	private _result?: ClassificationResult;
	private readonly _photos: Photo[] = [];
	private readonly _segments: ClassifiedSegment[] = [];

	private constructor(
		public readonly id: UUID,
		public readonly evaluationId: UUID,
		public readonly kind: ClassificationKind,
		public readonly iterationIndex: number,
		public readonly createdAt?: Date,
	) {}

	static create(params: {
		id: UUID;
		evaluationId: UUID;
		kind: ClassificationKind;
		iterationIndex: number;
		createdAt?: Date;
	}): ClassificationStep {
		const { id, evaluationId, kind, iterationIndex, createdAt } = params;

		if (!id || !evaluationId || !kind) {
			throw new ArgumentInvalidError(
				"ClassificationStep requires id, evaluationId, and kind.",
			);
		}

		if (!KINDS.includes(kind)) {
			throw new ArgumentInvalidError(
				`ClassificationStep.kind must be one of: ${KINDS.join(", ")}`,
			);
		}

		// Debe ser entero y dentro de [0,3]
		if (
			!Number.isInteger(iterationIndex) ||
			iterationIndex < 0 ||
			iterationIndex > 3
		) {
			throw new InvalidIterationIndexError(iterationIndex);
		}

		return new ClassificationStep(
			id,
			evaluationId,
			kind,
			iterationIndex,
			createdAt,
		);
	}

	/** Un solo resultado por step y debe pertenecer al mismo step */
	setResult(result: ClassificationResult): void {
		if (this._result) {
			throw new ArgumentInvalidError(
				"Classification step already has a result",
			);
		}
		if (result.stepId !== this.id) {
			throw new ArgumentInvalidError(
				"ClassificationResult.stepId must match ClassificationStep.id",
			);
		}
		this._result = result;
	}

	/** Agrega foto (única por uploadItemId) y debe pertenecer al mismo step */
	addPhoto(photo: Photo): void {
		if (photo.stepId !== this.id) {
			throw new ArgumentInvalidError(
				"Photo.stepId must match ClassificationStep.id",
			);
		}
		// Unicidad por uploadItemId (según esquema UNIQUE(step_id, upload_item_id))
		const exists = this._photos.some(
			(p) => p.uploadItemId === photo.uploadItemId,
		);
		if (exists) {
			throw new ArgumentInvalidError(
				`Photo with uploadItemId ${photo.uploadItemId} already exists in this step`,
			);
		}
		this._photos.push(photo);
	}

	/** Agrega segmento (único por uploadItemId) y debe pertenecer al mismo step */
	addSegment(segment: ClassifiedSegment): void {
		if (segment.stepId !== this.id) {
			throw new ArgumentInvalidError(
				"ClassifiedSegment.stepId must match ClassificationStep.id",
			);
		}
		const exists = this._segments.some(
			(s) => s.uploadItemId === segment.uploadItemId,
		);
		if (exists) {
			throw new ArgumentInvalidError(
				`Segment with uploadItemId ${segment.uploadItemId} already exists in this step`,
			);
		}
		this._segments.push(segment);
	}

	get result(): ClassificationResult | undefined {
		return this._result;
	}

	get photos(): readonly Photo[] {
		return this._photos;
	}

	get segments(): readonly ClassifiedSegment[] {
		return this._segments;
	}
}
