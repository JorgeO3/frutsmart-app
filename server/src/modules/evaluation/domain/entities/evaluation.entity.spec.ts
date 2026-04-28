import { Evaluation } from "./evaluation.entity";
import { ClassificationStep } from "./classification-step.entity";
import { ArgumentInvalidError } from "../errors/argument-invalid.error";
import { EvaluationAlreadyFinalizedError } from "../errors/evaluation-already-finalized.error";
import { InvalidIterationIndexError } from "../errors/invalid-iteration-index.error";
import { Traceability } from "../value-objects/traceability.vo";

// Helpers
const evalId = "11111111-1111-4111-8111-111111111111";
const otherEvalId = "22222222-2222-4222-8222-222222222222";
const stepId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const traceabilityMock =
	{} as unknown as import("../value-objects/traceability.vo").Traceability;
const geolocationMock =
	{} as unknown as import("../value-objects/geolocation.vo").Geolocation;
const harvestCriteriaMock =
	{} as unknown as import("../value-objects/harvest-criteria.vo").HarvestCriteria;

const makeEval = (over?: Partial<Parameters<typeof Evaluation.create>[0]>) =>
	Evaluation.create({
		id: evalId,
		type: "PLANT_ANALYSIS",
		creationTimestamp: new Date(),
		traceability: traceabilityMock,
		geolocation: geolocationMock,
		harvestCriteria: harvestCriteriaMock,
		// obligatorios
		truckPlate: "ABC123",
		consecutiveNumber: "FS-0001",
		deviceWeather: "clear",
		deviceTimeOfDay: "day",
		deviceHasInternet: true,
		...over,
	});

const makeStep = (
	over?: Partial<Parameters<typeof ClassificationStep.create>[0]>,
) =>
	ClassificationStep.create({
		id: stepId,
		evaluationId: evalId,
		kind: "external",
		iterationIndex: 0,
		...over,
	});

describe("Evaluation", () => {
	describe("create", () => {
		it("crea una evaluación válida", () => {
			const e = makeEval();
			expect(e).toBeDefined();
			expect(e.type).toBe("PLANT_ANALYSIS");
			expect(e.isFinalized).toBe(false);
			expect(e.steps.length).toBe(0);
			// nuevos obligatorios presentes
			expect(e.truckPlate).toBe("ABC123");
			expect(e.consecutiveNumber).toBe("FS-0001");
			expect(e.deviceWeather).toBe("clear");
			expect(e.deviceTimeOfDay).toBe("day");
			expect(e.deviceHasInternet).toBe(true);
		});

		it("falla si faltan id/type/creationTimestamp", () => {
			expect(() => makeEval({ id: undefined as unknown as string })).toThrow(
				ArgumentInvalidError,
			);

			expect(() =>
				makeEval({ type: undefined as unknown as "PLANT_ANALYSIS" }),
			).toThrow(ArgumentInvalidError);

			expect(() =>
				makeEval({ creationTimestamp: undefined as unknown as Date }),
			).toThrow(ArgumentInvalidError);
		});

		it("falla si faltan VO requeridos (traceability / geolocation / harvestCriteria)", () => {
			expect(() =>
				makeEval({ traceability: undefined as unknown as Traceability }),
			).toThrow(ArgumentInvalidError);

			expect(() => makeEval({ geolocation: undefined })).toThrow(
				ArgumentInvalidError,
			);

			expect(() => makeEval({ harvestCriteria: undefined })).toThrow(
				ArgumentInvalidError,
			);
		});

		it("falla si faltan los nuevos campos obligatorios del dominio", () => {
			expect(() => makeEval({ truckPlate: "" })).toThrow(ArgumentInvalidError);
			expect(() => makeEval({ consecutiveNumber: "" })).toThrow(
				ArgumentInvalidError,
			);
			expect(() => makeEval({ deviceWeather: "" })).toThrow(
				ArgumentInvalidError,
			);
			expect(() => makeEval({ deviceTimeOfDay: undefined })).toThrow(
				ArgumentInvalidError,
			);
			expect(() => makeEval({ deviceHasInternet: undefined })).toThrow(
				ArgumentInvalidError,
			);
		});
	});

	describe("addStep", () => {
		it("agrega un step válido (unicidad por kind+iterationIndex)", () => {
			const e = makeEval();
			const s = makeStep();
			e.addStep(s);
			expect(e.steps.length).toBe(1);
		});

		it("falla si step.evaluationId no coincide con evaluation.id", () => {
			const e = makeEval();
			const s = makeStep({ evaluationId: otherEvalId });
			expect(() => e.addStep(s)).toThrow(ArgumentInvalidError);
		});

		it("falla si iterationIndex fuera de rango o no entero", () => {
			const e = makeEval();
			expect(() => e.addStep(makeStep({ iterationIndex: 4 }))).toThrow(
				InvalidIterationIndexError,
			);
			expect(() => e.addStep(makeStep({ iterationIndex: 1.5 }))).toThrow(
				InvalidIterationIndexError,
			);
		});

		it("falla si ya existe el mismo (kind, iterationIndex)", () => {
			const e = makeEval();
			e.addStep(makeStep({ kind: "external", iterationIndex: 1 }));
			expect(() =>
				e.addStep(makeStep({ kind: "external", iterationIndex: 1 })),
			).toThrow(ArgumentInvalidError);
		});

		it("falla si la evaluación está finalizada", () => {
			const e = makeEval();
			e.finalize();
			expect(() => e.addStep(makeStep())).toThrow(
				EvaluationAlreadyFinalizedError,
			);
		});
	});

	describe("finalize", () => {
		it("marca isFinalized y no permite re-finalizar", () => {
			const e = makeEval();
			e.finalize();
			expect(e.isFinalized).toBe(true);
			expect(() => e.finalize()).toThrow(EvaluationAlreadyFinalizedError);
		});
	});
});
