// src/modules/evaluation/domain/entities/classification-result.entity.ts
import { ArgumentInvalidError } from "../errors/argument-invalid.error";
import { UUID } from "../types";

/**
 * ClassificationResult Entity (alineada a core.classification_results):
 *  - id: uuid PK (NOT NULL)
 *  - stepId: uuid (FK, NOT NULL)
 *  - aiClassName: text (NOT NULL)
 *  - aiConfidence: double precision (NOT NULL, 0..1)
 *  - aiRawConfidencesJson: jsonb (NOT NULL, objeto no vacío con valores 0..1)
 *  - hfIsCorrect, hfCorrectedClassName, hfObservation: opcionales
 *  - createdAt: timestamptz (DEFAULT now()) opcional al reconstituir
 *  - UNIQUE(step_id) se valida en persistencia (no aquí)
 */
export class ClassificationResult {
	private constructor(
		public readonly id: UUID,
		public readonly stepId: UUID,
		public readonly aiClassName: string,
		public readonly aiConfidence: number,
		public readonly aiRawConfidencesJson: Record<string, number>,
		public readonly hfIsCorrect?: boolean,
		public readonly hfCorrectedClassName?: string,
		public readonly hfObservation?: string,
		public readonly createdAt?: Date,
	) {}

	static create(params: {
		id: UUID;
		stepId: UUID;
		aiClassName: string;
		aiConfidence: number;
		aiRawConfidencesJson: Record<string, number>;
		hfIsCorrect?: boolean;
		hfCorrectedClassName?: string;
		hfObservation?: string;
		createdAt?: Date;
	}): ClassificationResult {
		const {
			id,
			stepId,
			aiClassName,
			aiConfidence,
			aiRawConfidencesJson,
			hfIsCorrect,
			hfCorrectedClassName,
			hfObservation,
			createdAt,
		} = params;

		// Requeridos
		if (!id)
			throw new ArgumentInvalidError("ClassificationResult.id is required.");
		if (!stepId)
			throw new ArgumentInvalidError(
				"ClassificationResult.stepId is required.",
			);
		if (!aiClassName || aiClassName.trim() === "") {
			throw new ArgumentInvalidError(
				"ClassificationResult.aiClassName is required.",
			);
		}

		// Rango confianza
		if (
			typeof aiConfidence !== "number" ||
			aiConfidence < 0 ||
			aiConfidence > 1
		) {
			throw new ArgumentInvalidError(
				`aiConfidence must be between 0 and 1, received: ${aiConfidence}`,
			);
		}

		// aiRawConfidencesJson: objeto no vacío con valores [0,1]
		if (
			aiRawConfidencesJson == null ||
			typeof aiRawConfidencesJson !== "object" ||
			Array.isArray(aiRawConfidencesJson)
		) {
			throw new ArgumentInvalidError(
				"aiRawConfidencesJson must be a JSON object.",
			);
		}
		const entries = Object.entries(
			aiRawConfidencesJson as Record<string, unknown>,
		);
		if (entries.length === 0) {
			throw new ArgumentInvalidError("aiRawConfidencesJson cannot be empty.");
		}
		for (const [k, v] of entries) {
			if (typeof v !== "number" || v < 0 || v > 1) {
				throw new ArgumentInvalidError(
					`aiRawConfidencesJson['${k}'] must be a number in [0,1].`,
				);
			}
		}

		return new ClassificationResult(
			id,
			stepId,
			aiClassName,
			aiConfidence,
			aiRawConfidencesJson as Record<string, number>,
			hfIsCorrect,
			hfCorrectedClassName,
			hfObservation,
			createdAt,
		);
	}
}
