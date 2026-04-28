// src/modules/evaluation/domain/entities/classification-result.entity.spec.ts
import { ClassificationResult } from "./classification-result.entity";
import { ArgumentInvalidError } from "../errors/argument-invalid.error";

describe("ClassificationResult", () => {
	const uuid = () => "11111111-1111-4111-8111-111111111111"; // as unknown as UUID

	describe("create (válido)", () => {
		it("crea un ClassificationResult válido", () => {
			const r = ClassificationResult.create({
				id: uuid(),
				stepId: uuid(),
				aiClassName: "banana",
				aiConfidence: 0.87,
				aiRawConfidencesJson: { banana: 0.87, apple: 0.13 },
				hfIsCorrect: true,
			});

			expect(r).toBeDefined();
			expect(r.aiClassName).toBe("banana");
			expect(r.aiConfidence).toBeCloseTo(0.87);
			expect(r.aiRawConfidencesJson.banana).toBeCloseTo(0.87);
			expect(r.hfIsCorrect).toBe(true);
		});
	});

	describe("requeridos", () => {
		it("lanza si falta id", () => {
			expect(() =>
				ClassificationResult.create({
					id: undefined as unknown as string,
					stepId: uuid(),
					aiClassName: "x",
					aiConfidence: 0.5,
					aiRawConfidencesJson: { x: 0.5 },
				}),
			).toThrow(ArgumentInvalidError);
		});

		it("lanza si falta stepId", () => {
			expect(() =>
				ClassificationResult.create({
					id: uuid(),
					stepId: undefined as unknown as string,
					aiClassName: "x",
					aiConfidence: 0.5,
					aiRawConfidencesJson: { x: 0.5 },
				}),
			).toThrow(ArgumentInvalidError);
		});

		it("lanza si aiClassName está vacío", () => {
			expect(() =>
				ClassificationResult.create({
					id: uuid(),
					stepId: uuid(),
					aiClassName: "   ",
					aiConfidence: 0.5,
					aiRawConfidencesJson: { x: 0.5 },
				}),
			).toThrow(ArgumentInvalidError);
		});
	});

	describe("aiConfidence (rango)", () => {
		it("lanza si < 0", () => {
			expect(() =>
				ClassificationResult.create({
					id: uuid(),
					stepId: uuid(),
					aiClassName: "x",
					aiConfidence: -0.01,
					aiRawConfidencesJson: { x: 1 },
				}),
			).toThrow(ArgumentInvalidError);
		});

		it("lanza si > 1", () => {
			expect(() =>
				ClassificationResult.create({
					id: uuid(),
					stepId: uuid(),
					aiClassName: "x",
					aiConfidence: 1.01,
					aiRawConfidencesJson: { x: 1 },
				}),
			).toThrow(ArgumentInvalidError);
		});

		it("acepta límites 0 y 1", () => {
			expect(() =>
				ClassificationResult.create({
					id: uuid(),
					stepId: uuid(),
					aiClassName: "x",
					aiConfidence: 0,
					aiRawConfidencesJson: { x: 1 },
				}),
			).not.toThrow();

			expect(() =>
				ClassificationResult.create({
					id: uuid(),
					stepId: uuid(),
					aiClassName: "x",
					aiConfidence: 1,
					aiRawConfidencesJson: { x: 1 },
				}),
			).not.toThrow();
		});
	});

	describe("aiRawConfidencesJson (forma)", () => {
		it("lanza si no es objeto", () => {
			expect(() =>
				ClassificationResult.create({
					id: uuid(),
					stepId: uuid(),
					aiClassName: "x",
					aiConfidence: 0.9,
					aiRawConfidencesJson: null as unknown as Record<string, number>,
				}),
			).toThrow(ArgumentInvalidError);
		});

		it("lanza si está vacío", () => {
			expect(() =>
				ClassificationResult.create({
					id: uuid(),
					stepId: uuid(),
					aiClassName: "x",
					aiConfidence: 0.9,
					aiRawConfidencesJson: {},
				}),
			).toThrow(ArgumentInvalidError);
		});

		it("lanza si algún valor está fuera de [0,1]", () => {
			expect(() =>
				ClassificationResult.create({
					id: uuid(),
					stepId: uuid(),
					aiClassName: "x",
					aiConfidence: 0.9,
					aiRawConfidencesJson: { x: 1.2 },
				}),
			).toThrow(ArgumentInvalidError);
		});

		it("acepta valores en los límites", () => {
			expect(() =>
				ClassificationResult.create({
					id: uuid(),
					stepId: uuid(),
					aiClassName: "x",
					aiConfidence: 1,
					aiRawConfidencesJson: { x: 1, y: 0 },
				}),
			).not.toThrow();
		});
	});
});
