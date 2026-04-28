import { Traceability } from "./traceability.vo";
import { TraceabilityViolationError } from "../errors/traceability-violation.error";
import { ProviderKind } from "../types";

describe("Traceability VO", () => {
	const uuid = "11111111-1111-4111-8111-111111111111";
	const uuid2 = "22222222-2222-4222-8222-222222222222";
	const uuid3 = "33333333-3333-4333-8333-333333333333";

	// FIELD_EVENT
	it("FIELD_EVENT válido (programId, lotId, centerId) y sin providerKind/providerId", () => {
		const t = Traceability.create({
			type: "FIELD_EVENT",
			programId: uuid,
			lotId: uuid2,
			centerId: uuid3,
			truckPlate: " ABC123 ", // permitido, se trimmea
		});
		expect(t.type).toBe("FIELD_EVENT");
		expect(t.providerKind).toBeUndefined();
		expect(t.providerId).toBeUndefined();
		expect(t.programId).toBe(uuid);
		expect(t.lotId).toBe(uuid2);
		expect(t.centerId).toBe(uuid3);
		expect(t.truckPlate).toBe("ABC123"); // trimmed
	});

	it("FIELD_EVENT inválido si faltan IDs de programa/lote/centro", () => {
		expect(() =>
			Traceability.create({
				type: "FIELD_EVENT",
				programId: uuid,
				lotId: uuid2,
				truckPlate: "AAA111",
			}),
		).toThrow(TraceabilityViolationError);
	});

	it("FIELD_EVENT inválido si viene providerKind o providerId", () => {
		expect(() =>
			Traceability.create({
				type: "FIELD_EVENT",
				programId: uuid,
				lotId: uuid2,
				centerId: uuid3,
				providerKind: "own",
				truckPlate: "AAA111",
			}),
		).toThrow(TraceabilityViolationError);

		expect(() =>
			Traceability.create({
				type: "FIELD_EVENT",
				programId: uuid,
				lotId: uuid2,
				centerId: uuid3,
				providerId: uuid,
				truckPlate: "AAA111",
			}),
		).toThrow(TraceabilityViolationError);
	});

	// PLANT_ANALYSIS third-party
	it("PLANT_ANALYSIS third-party válido (providerId + truckPlate, sin program/lot/center)", () => {
		const t = Traceability.create({
			type: "PLANT_ANALYSIS",
			providerKind: "third-party",
			providerId: uuid,
			truckPlate: " TTT999 ",
		});
		expect(t.type).toBe("PLANT_ANALYSIS");
		expect(t.providerKind).toBe("third-party");
		expect(t.providerId).toBe(uuid);
		expect(t.truckPlate).toBe("TTT999");
		expect(t.programId).toBeUndefined();
		expect(t.lotId).toBeUndefined();
		expect(t.centerId).toBeUndefined();
	});

	it("PLANT_ANALYSIS third-party inválido si falta providerId o truckPlate", () => {
		expect(() =>
			Traceability.create({
				type: "PLANT_ANALYSIS",
				providerKind: "third-party",
				// providerId falta
				truckPlate: "AAA111",
			}),
		).toThrow(TraceabilityViolationError);

		expect(() =>
			Traceability.create({
				type: "PLANT_ANALYSIS",
				providerKind: "third-party",
				providerId: uuid,
				truckPlate: "   ", // vacío
			}),
		).toThrow(TraceabilityViolationError);
	});

	it("PLANT_ANALYSIS third-party inválido si vienen program/lot/center", () => {
		expect(() =>
			Traceability.create({
				type: "PLANT_ANALYSIS",
				providerKind: "third-party",
				providerId: uuid,
				truckPlate: "AAA111",
				programId: uuid2,
			}),
		).toThrow(TraceabilityViolationError);
	});

	// PLANT_ANALYSIS own
	it("PLANT_ANALYSIS own válido (programId + truckPlate, sin providerId/lot/center)", () => {
		const t = Traceability.create({
			type: "PLANT_ANALYSIS",
			providerKind: "own",
			programId: uuid,
			truckPlate: " BBB222 ",
		});
		expect(t.providerKind).toBe("own");
		expect(t.programId).toBe(uuid);
		expect(t.truckPlate).toBe("BBB222");
		expect(t.providerId).toBeUndefined();
		expect(t.lotId).toBeUndefined();
		expect(t.centerId).toBeUndefined();
	});

	it("PLANT_ANALYSIS own inválido si falta programId o truckPlate", () => {
		expect(() =>
			Traceability.create({
				type: "PLANT_ANALYSIS",
				providerKind: "own",
				// programId falta
				truckPlate: "CCC333",
			}),
		).toThrow(TraceabilityViolationError);

		expect(() =>
			Traceability.create({
				type: "PLANT_ANALYSIS",
				providerKind: "own",
				programId: uuid,
				truckPlate: "",
			}),
		).toThrow(TraceabilityViolationError);
	});

	it("PLANT_ANALYSIS own inválido si viene providerId/lot/center", () => {
		expect(() =>
			Traceability.create({
				type: "PLANT_ANALYSIS",
				providerKind: "own",
				programId: uuid,
				truckPlate: "CCC333",
				providerId: uuid2,
			}),
		).toThrow(TraceabilityViolationError);
	});

	it("combinación inválida", () => {
		expect(() =>
			Traceability.create({
				// providerKind inválido
				type: "PLANT_ANALYSIS",
				providerKind: "unknown" as unknown as ProviderKind,
				truckPlate: "X",
			}),
		).toThrow(TraceabilityViolationError);
	});
});
