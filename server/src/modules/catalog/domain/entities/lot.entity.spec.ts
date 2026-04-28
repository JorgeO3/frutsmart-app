import { Lot } from "./lot.entity";
import { ArgumentInvalidError } from "../errors/argument-invalid.error";
import type { UUID } from "../types";

const uuid = (n = "1") =>
	`${n.repeat(8)}-${n.repeat(4)}-${n.repeat(4)}-${n.repeat(4)}-${n.repeat(12)}` as UUID;

describe("Lot (Domain Entity)", () => {
	it("CAT-LOT-CRT-001 creates a lot (happy path) and trims values", () => {
		const lot = Lot.create({
			id: ` ${uuid("2")} `,
			name: "  Lote Principal  ",
			programId: ` ${uuid("3")} `,
		});
		expect(lot.id).toBe(uuid("2"));
		expect(lot.name).toBe("Lote Principal");
		expect(lot.programId).toBe(uuid("3"));
	});

	it("CAT-LOT-CRT-002 throws when id is empty", () => {
		expect(() =>
			Lot.create({ id: " " as UUID, name: "A", programId: uuid("3") }),
		).toThrow(ArgumentInvalidError);
	});

	it("CAT-LOT-CRT-003 throws when name is empty", () => {
		expect(() =>
			Lot.create({ id: uuid("2"), name: " ", programId: uuid("3") }),
		).toThrow(ArgumentInvalidError);
	});

	it("CAT-LOT-CRT-004 throws when programId is empty", () => {
		expect(() =>
			Lot.create({ id: uuid("2"), name: "A", programId: " " as UUID }),
		).toThrow(ArgumentInvalidError);
	});

	it("CAT-LOT-REN-001 rename updates the name and trims", () => {
		const lot = Lot.create({
			id: uuid("2"),
			name: "A",
			programId: uuid("3"),
		});
		lot.rename("  Nuevo Lote  ");
		expect(lot.name).toBe("Nuevo Lote");
	});

	it("CAT-LOT-REN-002 rename throws on empty", () => {
		const lot = Lot.create({
			id: uuid("2"),
			name: "A",
			programId: uuid("3"),
		});
		expect(() => lot.rename(" ")).toThrow(ArgumentInvalidError);
	});

	it("CAT-LOT-MOV-001 moveToProgram updates programId and trims", () => {
		const lot = Lot.create({
			id: uuid("2"),
			name: "A",
			programId: uuid("3"),
		});
		lot.moveToProgram(` ${uuid("4")} `);
		expect(lot.programId).toBe(uuid("4"));
	});

	it("CAT-LOT-MOV-002 moveToProgram throws on empty", () => {
		const lot = Lot.create({
			id: uuid("2"),
			name: "A",
			programId: uuid("3"),
		});
		expect(() => lot.moveToProgram(" " as UUID)).toThrow(ArgumentInvalidError);
	});
});
