// src/modules/evaluation/domain/entities/classification-step.entity.spec.ts
import { ClassificationStep } from "./classification-step.entity";
import { ClassificationResult } from "./classification-result.entity";
import { Photo } from "./photo.entity";
import { ClassifiedSegment } from "./classified-segment.entity";
import { ArgumentInvalidError } from "../errors/argument-invalid.error";
import { InvalidIterationIndexError } from "../errors/invalid-iteration-index.error";

const uuid = () => "11111111-1111-4111-8111-111111111111";
const uuid2 = () => "22222222-2222-4222-8222-222222222222";
const uid = (n: number) =>
	`00000000-0000-4000-8000-${n.toString().padStart(12, "0")}`;

describe("ClassificationStep", () => {
	describe("create", () => {
		it("crea válido con kind permitido y iterationIndex 0..3", () => {
			const s = ClassificationStep.create({
				id: uuid(),
				evaluationId: uuid2(),
				kind: "external",
				iterationIndex: 0,
			});
			expect(s).toBeDefined();
			expect(s.kind).toBe("external");
			expect(s.iterationIndex).toBe(0);
		});

		it("lanza si kind no es válido", () => {
			expect(() =>
				ClassificationStep.create({
					id: uuid(),
					evaluationId: uuid2(),
					// @ts-expect-error forzando valor inválido
					kind: "weird",
					iterationIndex: 1,
				}),
			).toThrow(ArgumentInvalidError);
		});

		it("lanza si iterationIndex fuera de rango", () => {
			expect(() =>
				ClassificationStep.create({
					id: uuid(),
					evaluationId: uuid2(),
					kind: "internal",
					iterationIndex: 4,
				}),
			).toThrow(InvalidIterationIndexError);
		});

		it("lanza si iterationIndex no es entero", () => {
			expect(() =>
				ClassificationStep.create({
					id: uuid(),
					evaluationId: uuid2(),
					kind: "internal",
					iterationIndex: 1.5,
				}),
			).toThrow(InvalidIterationIndexError);
		});
	});

	describe("setResult", () => {
		it("setea un único resultado y exige stepId coincidente", () => {
			const stepId = uuid();
			const step = ClassificationStep.create({
				id: stepId,
				evaluationId: uuid2(),
				kind: "external",
				iterationIndex: 0,
			});

			const result = ClassificationResult.create({
				id: uid(1),
				stepId, // coincide
				aiClassName: "cls",
				aiConfidence: 0.7,
				aiRawConfidencesJson: { cls: 0.7, other: 0.3 },
			});

			step.setResult(result);
			expect(step.result).toBeDefined();

			// Segundo set debe fallar
			expect(() => step.setResult(result)).toThrow(ArgumentInvalidError);
		});

		it("falla si el result.stepId no coincide", () => {
			const step = ClassificationStep.create({
				id: uuid(),
				evaluationId: uuid2(),
				kind: "external",
				iterationIndex: 0,
			});

			const mismatched = ClassificationResult.create({
				id: uid(2),
				stepId: uuid2(), // distinto
				aiClassName: "x",
				aiConfidence: 0.5,
				aiRawConfidencesJson: { x: 0.5 },
			});

			expect(() => step.setResult(mismatched)).toThrow(ArgumentInvalidError);
		});
	});

	describe("addPhoto", () => {
		it("agrega una foto válida y evita duplicados por uploadItemId", () => {
			const stepId = uuid();
			const step = ClassificationStep.create({
				id: stepId,
				evaluationId: uuid2(),
				kind: "internal",
				iterationIndex: 2,
			});

			const p1 = Photo.create({
				id: uid(3),
				stepId,
				role: "raw",
				// entidad Photo de dominio actual requiere uploadItemId (esquema UNIQUE por uploadItemId)
				uploadItemId: uid(4),
			});

			const p2 = Photo.create({
				id: uid(5),
				stepId,
				role: "raw",
				uploadItemId: uid(6),
			});

			step.addPhoto(p1);
			step.addPhoto(p2);
			expect(step.photos.length).toBe(2);

			// Duplicado por uploadItemId
			const dup = Photo.create({
				id: uid(7),
				stepId,
				role: "raw",
				uploadItemId: uid(4), // igual que p1
			});
			expect(() => step.addPhoto(dup)).toThrow(ArgumentInvalidError);
		});

		it("falla si la foto es de otro step", () => {
			const step = ClassificationStep.create({
				id: uuid(),
				evaluationId: uuid2(),
				kind: "external",
				iterationIndex: 0,
			});

			const photo = Photo.create({
				id: uid(8),
				stepId: uuid2(), // distinto
				role: "raw",
				uploadItemId: uid(9),
			});

			expect(() => step.addPhoto(photo)).toThrow(ArgumentInvalidError);
		});
	});

	describe("addSegment", () => {
		it("agrega un segmento válido y evita duplicados por uploadItemId", () => {
			const stepId = uuid();
			const step = ClassificationStep.create({
				id: stepId,
				evaluationId: uuid2(),
				kind: "internal",
				iterationIndex: 1,
			});

			const s1 = ClassifiedSegment.create({
				id: uid(10),
				stepId,
				uploadItemId: uid(11),
				bestClassName: "ok",
				bestConfidence: 0.9,
				confidencesJson: { ok: 0.9 },
			});

			const s2 = ClassifiedSegment.create({
				id: uid(12),
				stepId,
				uploadItemId: uid(13),
				bestClassName: "ok",
				bestConfidence: 0.8,
				confidencesJson: { ok: 0.8 },
			});

			step.addSegment(s1);
			step.addSegment(s2);
			expect(step.segments.length).toBe(2);

			// Duplicado por uploadItemId
			const dup = ClassifiedSegment.create({
				id: uid(14),
				stepId,
				uploadItemId: uid(11), // igual a s1
				bestClassName: "ok",
				bestConfidence: 0.7,
				confidencesJson: { ok: 0.7 },
			});
			expect(() => step.addSegment(dup)).toThrow(ArgumentInvalidError);
		});

		it("falla si el segmento es de otro step", () => {
			const step = ClassificationStep.create({
				id: uuid(),
				evaluationId: uuid2(),
				kind: "internal",
				iterationIndex: 3,
			});

			const seg = ClassifiedSegment.create({
				id: uid(15),
				stepId: uuid2(), // distinto
				uploadItemId: uid(16),
				bestClassName: "cls",
				bestConfidence: 0.6,
				confidencesJson: { cls: 0.6 },
			});

			expect(() => step.addSegment(seg)).toThrow(ArgumentInvalidError);
		});
	});
});
