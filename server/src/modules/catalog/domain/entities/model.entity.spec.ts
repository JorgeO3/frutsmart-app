import { Model } from "./model.entity";
import { ArgumentInvalidError } from "../errors/argument-invalid.error";
import { MODEL_TYPES, type ModelType, type UUID } from "../types";

const uuid = (n = "4") =>
	`${n.repeat(8)}-${n.repeat(4)}-${n.repeat(4)}-${n.repeat(4)}-${n.repeat(12)}` as UUID;

describe("Model (Domain Entity)", () => {
	const validType: ModelType = MODEL_TYPES[0];

	it("CAT-MOD-CRT-001 creates a model (happy path) and trims", () => {
		const m = Model.create({
			id: ` ${uuid("4")} `,
			name: "  Detector X  ",
			versionTag: "  v1.0  ",
			type: validType,
		});
		expect(m.id).toBe(uuid("4"));
		expect(m.name).toBe("Detector X");
		expect(m.versionTag).toBe("v1.0");
		expect(MODEL_TYPES).toContain(m.type);
	});

	it("CAT-MOD-CRT-002 throws when id is empty", () => {
		expect(() =>
			Model.create({
				id: " " as UUID,
				name: "N",
				versionTag: "v",
				type: validType,
			}),
		).toThrow(ArgumentInvalidError);
	});

	it("CAT-MOD-CRT-003 throws when name is empty", () => {
		expect(() =>
			Model.create({
				id: uuid("4"),
				name: " ",
				versionTag: "v",
				type: validType,
			}),
		).toThrow(ArgumentInvalidError);
	});

	it("CAT-MOD-CRT-004 throws when versionTag is empty", () => {
		expect(() =>
			Model.create({
				id: uuid("4"),
				name: "N",
				versionTag: " ",
				type: validType,
			}),
		).toThrow(ArgumentInvalidError);
	});

	it("CAT-MOD-CRT-005 throws when type is not in MODEL_TYPES", () => {
		expect(() =>
			Model.create({
				id: uuid("4"),
				name: "N",
				versionTag: "v",
				type: "unknown" as ModelType,
			}),
		).toThrow(ArgumentInvalidError);
	});

	it("CAT-MOD-REN-001 rename updates name and trims", () => {
		const m = Model.create({
			id: uuid("4"),
			name: "A",
			versionTag: "v",
			type: validType,
		});
		m.rename("  B  ");
		expect(m.name).toBe("B");
	});

	it("CAT-MOD-REN-002 rename throws on empty", () => {
		const m = Model.create({
			id: uuid("4"),
			name: "A",
			versionTag: "v",
			type: validType,
		});
		expect(() => m.rename(" ")).toThrow(ArgumentInvalidError);
	});
});
