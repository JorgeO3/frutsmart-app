import { ArgumentInvalidError } from "../errors/argument-invalid.error";
import { UUID } from "../types";

/**
 * ClassifiedSegment Entity
 *
 * Alineada con core.classified_segments:
 *  - id: uuid PK
 *  - step_id: uuid NOT NULL
 *  - upload_item_id: uuid NOT NULL
 *  - best_class_name: text NOT NULL
 *  - best_confidence: double precision NOT NULL (0..1)
 *  - confidences_json: jsonb NOT NULL
 *  - created_at: timestamptz NOT NULL DEFAULT now()
 */
export class ClassifiedSegment {
	private constructor(
		public readonly id: UUID,
		public readonly stepId: UUID,
		public readonly uploadItemId: UUID,
		public readonly bestClassName: string,
		public readonly bestConfidence: number,
		public readonly confidencesJson: Record<string, number>,
		public readonly createdAt?: Date,
	) {}

	/**
	 * Factory con validaciones de invariante de dominio.
	 */
	static create(params: {
		id: UUID;
		stepId: UUID;
		uploadItemId: UUID;
		bestClassName: string;
		bestConfidence: number;
		confidencesJson: Record<string, number>;
		createdAt?: Date;
	}): ClassifiedSegment {
		const {
			id,
			stepId,
			uploadItemId,
			bestClassName,
			bestConfidence,
			confidencesJson,
			createdAt,
		} = params;

		// Requeridos
		if (!id)
			throw new ArgumentInvalidError("ClassifiedSegment.id is required.");
		if (!stepId)
			throw new ArgumentInvalidError("ClassifiedSegment.stepId is required.");
		if (!uploadItemId)
			throw new ArgumentInvalidError(
				"ClassifiedSegment.uploadItemId is required.",
			);
		if (!bestClassName || bestClassName.trim() === "") {
			throw new ArgumentInvalidError(
				"ClassifiedSegment.bestClassName is required.",
			);
		}

		// Rango confianza
		if (
			typeof bestConfidence !== "number" ||
			bestConfidence < 0 ||
			bestConfidence > 1
		) {
			throw new ArgumentInvalidError(
				`bestConfidence must be between 0 and 1, received: ${bestConfidence}`,
			);
		}

		// confidencesJson: objeto no vacío con valores en [0,1]
		if (
			confidencesJson == null ||
			typeof confidencesJson !== "object" ||
			Array.isArray(confidencesJson)
		) {
			throw new ArgumentInvalidError("confidencesJson must be a JSON object.");
		}
		const entries = Object.entries(confidencesJson as Record<string, unknown>);
		if (entries.length === 0) {
			throw new ArgumentInvalidError("confidencesJson cannot be empty.");
		}
		for (const [k, v] of entries) {
			if (typeof v !== "number" || v < 0 || v > 1) {
				throw new ArgumentInvalidError(
					`confidencesJson['${k}'] must be a number in [0,1].`,
				);
			}
		}

		return new ClassifiedSegment(
			id,
			stepId,
			uploadItemId,
			bestClassName,
			bestConfidence,
			confidencesJson as Record<string, number>,
			createdAt,
		);
	}
}
