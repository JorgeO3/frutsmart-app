import { TraceabilityViolationError } from "../errors/traceability-violation.error";
import { EvaluationType, ProviderKind, UUID } from "../types";

function isNonEmptyString(x: unknown): x is string {
	return typeof x === "string" && x.trim().length > 0;
}

/**
 * Traceability Value Object
 *
 * Mirror del CHECK de DB + regla de dominio:
 * - truckPlate: OBLIGATORIA para ambos tipos
 * - FIELD_EVENT: requiere programId, lotId, centerId; prohíbe providerKind/providerId
 * - PLANT_ANALYSIS + third-party: requiere providerId; prohíbe programId/lotId/centerId
 * - PLANT_ANALYSIS + own: requiere programId; prohíbe providerId/lotId/centerId
 */
export class Traceability {
	private constructor(
		public readonly type: EvaluationType,
		public readonly providerKind: ProviderKind | undefined, // undefined en FIELD_EVENT
		public readonly programId: UUID | undefined,
		public readonly lotId: UUID | undefined,
		public readonly centerId: UUID | undefined,
		public readonly providerId: UUID | undefined,
		public readonly truckPlate: string, // siempre presente y trimmeada
	) {}

	static create(params: {
		type: EvaluationType;
		providerKind?: ProviderKind;
		programId?: UUID;
		lotId?: UUID;
		centerId?: UUID;
		providerId?: UUID;
		truckPlate: string; // input opcional, pero validamos que sea requerido
	}): Traceability {
		const {
			type,
			providerKind,
			programId,
			lotId,
			centerId,
			providerId,
			truckPlate,
		} = params;

		// truckPlate: obligatoria y non-empty
		if (!isNonEmptyString(truckPlate)) {
			throw new TraceabilityViolationError(
				"Traceability requires a non-empty truckPlate",
			);
		}
		const plate = truckPlate.trim();

		// FIELD_EVENT
		if (type === "FIELD_EVENT") {
			if (!programId || !lotId || !centerId) {
				throw new TraceabilityViolationError(
					"FIELD_EVENT requires programId, lotId, and centerId",
				);
			}
			if (providerKind !== undefined || providerId !== undefined) {
				throw new TraceabilityViolationError(
					"FIELD_EVENT must not have providerKind or providerId",
				);
			}
			return new Traceability(
				type,
				undefined,
				programId,
				lotId,
				centerId,
				undefined,
				plate,
			);
		}

		// PLANT_ANALYSIS
		if (type === "PLANT_ANALYSIS") {
			if (!providerKind) {
				throw new TraceabilityViolationError(
					"PLANT_ANALYSIS requires providerKind",
				);
			}

			if (providerKind === "third-party") {
				if (!providerId) {
					throw new TraceabilityViolationError(
						"PLANT_ANALYSIS with third-party requires providerId",
					);
				}
				if (
					programId !== undefined ||
					lotId !== undefined ||
					centerId !== undefined
				) {
					throw new TraceabilityViolationError(
						"PLANT_ANALYSIS with third-party must not have programId, lotId, or centerId",
					);
				}
				return new Traceability(
					type,
					providerKind,
					undefined,
					undefined,
					undefined,
					providerId,
					plate,
				);
			}

			if (providerKind === "own") {
				if (!programId) {
					throw new TraceabilityViolationError(
						"PLANT_ANALYSIS with own requires programId",
					);
				}
				if (
					providerId !== undefined ||
					lotId !== undefined ||
					centerId !== undefined
				) {
					throw new TraceabilityViolationError(
						"PLANT_ANALYSIS with own must not have providerId, lotId, or centerId",
					);
				}
				return new Traceability(
					type,
					providerKind,
					programId,
					undefined,
					undefined,
					undefined,
					plate,
				);
			}
		}

		throw new TraceabilityViolationError(
			"Invalid combination of type and providerKind",
		);
	}
}
