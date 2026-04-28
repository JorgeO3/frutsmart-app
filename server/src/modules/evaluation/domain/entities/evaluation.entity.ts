import { ArgumentInvalidError } from "../errors/argument-invalid.error";
import { EvaluationAlreadyFinalizedError } from "../errors/evaluation-already-finalized.error";
import { InvalidIterationIndexError } from "../errors/invalid-iteration-index.error";
import { EvaluationType, TimeOfDay, UUID } from "../types";
import { Geolocation } from "../value-objects/geolocation.vo";
import { HarvestCriteria } from "../value-objects/harvest-criteria.vo";
import { Traceability } from "../value-objects/traceability.vo";
import { ClassificationStep } from "./classification-step.entity";

type EvaluationRequired = {
	id: UUID;
	type: EvaluationType;
	creationTimestamp: Date;
	traceability: Traceability;
	geolocation: Geolocation;
	harvestCriteria: HarvestCriteria;

	// OBLIGATORIOS (NOT NULL en DB)
	consecutiveNumber: string;
	truckPlate: string;
	deviceWeather: string;
	deviceTimeOfDay: TimeOfDay;
	deviceHasInternet: boolean;
};

type EvaluationOptional = {
	uploadSessionId?: UUID;
	qrCode?: string;
	harvestObservation?: string;
	subProviderId?: UUID;
	modelDetectionId?: UUID;
	modelExternalId?: UUID;
	modelInternalId?: UUID;
	createdAt?: Date;

	/** Nueva colección de lots (IDs) para el join table core.evaluation_lots */
	lots?: UUID[];
};

type EvaluationProps = EvaluationRequired & EvaluationOptional;

/**
 * Evaluation Aggregate Root
 */
export class Evaluation {
	private readonly _steps: ClassificationStep[] = [];

	/** Colección de lots asociada al agregado (persistida en core.evaluation_lots) */
	private readonly _lots: Set<UUID> = new Set();

	private _isFinalized = false;

	private constructor(private readonly props: EvaluationProps) {
		if (props.lots?.length) {
			for (const lotId of props.lots) this._lots.add(lotId);
		}
	}

	static create(params: EvaluationProps): Evaluation {
		const {
			id,
			type,
			creationTimestamp,
			traceability,
			geolocation,
			harvestCriteria,
			consecutiveNumber,
			truckPlate,
			deviceWeather,
			deviceTimeOfDay,
			deviceHasInternet,
		} = params;

		// Invariantes mínimas
		if (!id || !type || !creationTimestamp) {
			throw new ArgumentInvalidError(
				"Evaluation requires id, type, and creationTimestamp",
			);
		}
		if (!traceability) {
			throw new ArgumentInvalidError("Evaluation.traceability is required");
		}
		if (!geolocation) {
			throw new ArgumentInvalidError("Evaluation.geolocation is required");
		}
		if (!harvestCriteria) {
			throw new ArgumentInvalidError("Evaluation.harvestCriteria is required");
		}

		// Campos requeridos (DB NOT NULL)
		if (!consecutiveNumber || !consecutiveNumber.trim()) {
			throw new ArgumentInvalidError(
				"Evaluation.consecutiveNumber is required",
			);
		}
		if (!truckPlate || !truckPlate.trim()) {
			throw new ArgumentInvalidError("Evaluation.truckPlate is required");
		}
		if (!deviceWeather || !deviceWeather.trim()) {
			throw new ArgumentInvalidError("Evaluation.deviceWeather is required");
		}
		if (!deviceTimeOfDay) {
			throw new ArgumentInvalidError("Evaluation.deviceTimeOfDay is required");
		}
		if (typeof deviceHasInternet !== "boolean") {
			throw new ArgumentInvalidError(
				"Evaluation.deviceHasInternet is required (boolean)",
			);
		}

		return new Evaluation(params);
	}

	/**
	 * Agrega un step con invariantes de dominio.
	 * - step.evaluationId debe ser esta evaluación
	 * - iterationIndex ∈ [0,3] y entero
	 * - unicidad por (kind, iterationIndex)
	 * - no se permite si la evaluación está finalizada
	 */
	addStep(step: ClassificationStep): void {
		if (this._isFinalized) {
			throw new EvaluationAlreadyFinalizedError(this.id);
		}
		if (step.evaluationId !== this.id) {
			throw new ArgumentInvalidError(
				"ClassificationStep.evaluationId must match Evaluation.id",
			);
		}
		if (
			step.iterationIndex < 0 ||
			step.iterationIndex > 3 ||
			!Number.isInteger(step.iterationIndex)
		) {
			throw new InvalidIterationIndexError(step.iterationIndex);
		}
		const exists = this._steps.some(
			(s) => s.kind === step.kind && s.iterationIndex === step.iterationIndex,
		);
		if (exists) {
			throw new ArgumentInvalidError(
				`Step with kind ${step.kind} and iterationIndex ${step.iterationIndex} already exists`,
			);
		}
		this._steps.push(step);
	}

	// ======================
	// Gestión de EvaluationLots
	// ======================

	/** Agrega un lot a la evaluación (entidad de asociación). */
	addLot(lotId: UUID): void {
		if (this._isFinalized) {
			throw new EvaluationAlreadyFinalizedError(this.id);
		}
		if (!lotId) {
			throw new ArgumentInvalidError("lotId is required");
		}
		this._lots.add(lotId);
	}

	/** Elimina un lot asociado. */
	removeLot(lotId: UUID): void {
		if (this._isFinalized) {
			throw new EvaluationAlreadyFinalizedError(this.id);
		}
		this._lots.delete(lotId);
	}

	/** Marca la evaluación como finalizada (idempotencia controlada) */
	finalize(): void {
		if (this._isFinalized) {
			throw new EvaluationAlreadyFinalizedError(this.id);
		}

		// Invariante clave: si PLANT_ANALYSIS + own ⇒ al menos 1 lot asociado
		// (refleja el trigger core.assert_eval_own_has_lots en la BD)
		const providerKind = this.traceability.providerKind;

		if (this.type === "PLANT_ANALYSIS" && providerKind === "own") {
			if (this._lots.size === 0) {
				throw new ArgumentInvalidError(
					"Evaluation.lots must contain at least one lot when type=PLANT_ANALYSIS and providerKind=own",
				);
			}
		}

		this._isFinalized = true;
	}

	// ==== Getters (exponen props de forma inmutable) ====
	get id(): UUID {
		return this.props.id;
	}
	get type(): EvaluationType {
		return this.props.type;
	}
	get creationTimestamp(): Date {
		return this.props.creationTimestamp;
	}
	get traceability(): Traceability {
		return this.props.traceability;
	}
	get geolocation(): Geolocation {
		return this.props.geolocation;
	}
	get harvestCriteria(): HarvestCriteria {
		return this.props.harvestCriteria;
	}

	get uploadSessionId(): UUID | undefined {
		return this.props.uploadSessionId;
	}
	get qrCode(): string | undefined {
		return this.props.qrCode;
	}
	get harvestObservation(): string | undefined {
		return this.props.harvestObservation;
	}
	get subProviderId(): UUID | undefined {
		return this.props.subProviderId;
	}
	get modelDetectionId(): UUID | undefined {
		return this.props.modelDetectionId;
	}
	get modelExternalId(): UUID | undefined {
		return this.props.modelExternalId;
	}
	get modelInternalId(): UUID | undefined {
		return this.props.modelInternalId;
	}
	get createdAt(): Date | undefined {
		return this.props.createdAt;
	}

	get consecutiveNumber(): string {
		return this.props.consecutiveNumber;
	}
	get truckPlate(): string {
		return this.props.truckPlate;
	}
	get deviceWeather(): string {
		return this.props.deviceWeather;
	}
	get deviceTimeOfDay(): TimeOfDay {
		return this.props.deviceTimeOfDay;
	}
	get deviceHasInternet(): boolean {
		return this.props.deviceHasInternet;
	}

	get steps(): readonly ClassificationStep[] {
		return this._steps;
	}

	/** Lots como arreglo inmutable (IDs) */
	get lots(): readonly UUID[] {
		return Array.from(this._lots);
	}

	get isFinalized(): boolean {
		return this._isFinalized;
	}
}
