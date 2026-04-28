import { Center } from "./center.entity";
import { ArgumentInvalidError } from "../errors/argument-invalid.error";
import type { UUID } from "../types";

const uuid = (n = "1") =>
	`${n.repeat(8)}-${n.repeat(4)}-${n.repeat(4)}-${n.repeat(4)}-${n.repeat(12)}` as UUID;

describe("Center (Domain Entity)", () => {
	it("CAT-CEN-CRT-001 creates a center (happy path) and trims values", () => {
		const c = Center.create({
			id: ` ${uuid("1")} `,
			name: "  Central Norte  ",
			lotId: ` ${uuid("2")} `,
		});
		expect(c.id).toBe(uuid("1"));
		expect(c.name).toBe("Central Norte");
		expect(c.lotId).toBe(uuid("2"));
	});

	it("CAT-CEN-CRT-002 throws when id is empty", () => {
		expect(() =>
			Center.create({ id: " " as UUID, name: "A", lotId: uuid("2") }),
		).toThrow(ArgumentInvalidError);
	});

	it("CAT-CEN-CRT-003 throws when name is empty", () => {
		expect(() =>
			Center.create({ id: uuid("1"), name: " ", lotId: uuid("2") }),
		).toThrow(ArgumentInvalidError);
	});

	it("CAT-CEN-CRT-004 throws when lotId is empty", () => {
		expect(() =>
			Center.create({ id: uuid("1"), name: "A", lotId: " " as UUID }),
		).toThrow(ArgumentInvalidError);
	});

	it("CAT-CEN-REN-001 rename updates the name and trims", () => {
		const c = Center.create({ id: uuid("1"), name: "A", lotId: uuid("2") });
		c.rename("  Nuevo Centro  ");
		expect(c.name).toBe("Nuevo Centro");
	});

	it("CAT-CEN-REN-002 rename throws on empty", () => {
		const c = Center.create({ id: uuid("1"), name: "A", lotId: uuid("2") });
		expect(() => c.rename(" ")).toThrow(ArgumentInvalidError);
	});

	it("CAT-CEN-MOV-001 moveToLot updates lotId and trims", () => {
		const c = Center.create({ id: uuid("1"), name: "A", lotId: uuid("2") });
		c.moveToLot(` ${uuid("3")} `);
		expect(c.lotId).toBe(uuid("3"));
	});

	it("CAT-CEN-MOV-002 moveToLot throws on empty", () => {
		const c = Center.create({ id: uuid("1"), name: "A", lotId: uuid("2") });
		expect(() => c.moveToLot(" " as UUID)).toThrow(ArgumentInvalidError);
	});
});
