// src/modules/evaluation/domain/entities/classified-segment.entity.spec.ts
import { ClassifiedSegment } from "./classified-segment.entity";
import { ArgumentInvalidError } from "../errors/argument-invalid.error";

describe("ClassifiedSegment", () => {
	const uuid = () => "11111111-1111-4111-8111-111111111111";

	describe("create (válido)", () => {
		it("crea un ClassifiedSegment válido", () => {
			const seg = ClassifiedSegment.create({
				id: uuid(),
				stepId: uuid(),
				uploadItemId: uuid(),
				bestClassName: "classA",
				bestConfidence: 0.92,
				confidencesJson: { classA: 0.92, classB: 0.08 },
			});

			expect(seg).toBeDefined();
			expect(seg.bestClassName).toBe("classA");
			expect(seg.bestConfidence).toBeCloseTo(0.92);
			expect(seg.uploadItemId).toBeDefined();
			expect(seg.confidencesJson.classA).toBeCloseTo(0.92);
		});
	});

	describe("create (requeridos)", () => {
		it("lanza si falta id", () => {
			expect(() =>
				ClassifiedSegment.create({
					id: undefined as unknown as string,
					stepId: uuid(),
					uploadItemId: uuid(),
					bestClassName: "x",
					bestConfidence: 0.5,
					confidencesJson: { x: 0.5 },
				}),
			).toThrow(ArgumentInvalidError);
		});

		it("lanza si falta stepId", () => {
			expect(() =>
				ClassifiedSegment.create({
					id: uuid(),
					stepId: undefined as unknown as string,
					uploadItemId: uuid(),
					bestClassName: "x",
					bestConfidence: 0.5,
					confidencesJson: { x: 0.5 },
				}),
			).toThrow(ArgumentInvalidError);
		});

		it("lanza si falta uploadItemId (NOT NULL en schema)", () => {
			expect(() =>
				ClassifiedSegment.create({
					id: uuid(),
					stepId: uuid(),
					uploadItemId: undefined as unknown as string,
					bestClassName: "x",
					bestConfidence: 0.5,
					confidencesJson: { x: 0.5 },
				}),
			).toThrow(ArgumentInvalidError);
		});

		it("lanza si bestClassName es vacío", () => {
			expect(() =>
				ClassifiedSegment.create({
					id: uuid(),
					stepId: uuid(),
					uploadItemId: uuid(),
					bestClassName: "  ",
					bestConfidence: 0.5,
					confidencesJson: { x: 0.5 },
				}),
			).toThrow(ArgumentInvalidError);
		});
	});

	describe("create (validación de confianza)", () => {
		it("lanza si bestConfidence < 0", () => {
			expect(() =>
				ClassifiedSegment.create({
					id: uuid(),
					stepId: uuid(),
					uploadItemId: uuid(),
					bestClassName: "x",
					bestConfidence: -0.01,
					confidencesJson: { x: 1 },
				}),
			).toThrow(ArgumentInvalidError);
		});

		it("lanza si bestConfidence > 1", () => {
			expect(() =>
				ClassifiedSegment.create({
					id: uuid(),
					stepId: uuid(),
					uploadItemId: uuid(),
					bestClassName: "x",
					bestConfidence: 1.01,
					confidencesJson: { x: 1 },
				}),
			).toThrow(ArgumentInvalidError);
		});
	});

	describe("create (validación de confidencesJson)", () => {
		it("lanza si confidencesJson no es objeto", () => {
			expect(() =>
				ClassifiedSegment.create({
					id: uuid(),
					stepId: uuid(),
					uploadItemId: uuid(),
					bestClassName: "x",
					bestConfidence: 0.5,
					confidencesJson: null as unknown as Record<string, number>,
				}),
			).toThrow(ArgumentInvalidError);
		});

		it("lanza si confidencesJson está vacío", () => {
			expect(() =>
				ClassifiedSegment.create({
					id: uuid(),
					stepId: uuid(),
					uploadItemId: uuid(),
					bestClassName: "x",
					bestConfidence: 0.5,
					confidencesJson: {},
				}),
			).toThrow(ArgumentInvalidError);
		});

		it("lanza si algún valor de confidencesJson está fuera de [0,1]", () => {
			expect(() =>
				ClassifiedSegment.create({
					id: uuid(),
					stepId: uuid(),
					uploadItemId: uuid(),
					bestClassName: "x",
					bestConfidence: 0.5,
					confidencesJson: { x: 1.2 },
				}),
			).toThrow(ArgumentInvalidError);
		});

		it("acepta valores de 0 y 1 en los límites", () => {
			expect(() =>
				ClassifiedSegment.create({
					id: uuid(),
					stepId: uuid(),
					uploadItemId: uuid(),
					bestClassName: "x",
					bestConfidence: 1,
					confidencesJson: { x: 1, y: 0 },
				}),
			).not.toThrow();
		});
	});
});
