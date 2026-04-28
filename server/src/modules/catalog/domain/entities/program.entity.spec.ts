import { Program } from "./program.entity";
import { ArgumentInvalidError } from "../errors/argument-invalid.error";
import type { UUID } from "../types";

const uuid = (n = "5") =>
	`${n.repeat(8)}-${n.repeat(4)}-${n.repeat(4)}-${n.repeat(4)}-${n.repeat(12)}` as UUID;

describe("Program (Domain Entity)", () => {
	it("CAT-PRG-CRT-001 creates a program (happy path) and trims values", () => {
		const p = Program.create({
			id: ` ${uuid("5")} `,
			name: "  Programa Alpha  ",
		});
		expect(p.id).toBe(uuid("5"));
		expect(p.name).toBe("Programa Alpha");
	});

	it("CAT-PRG-CRT-002 throws when id is empty", () => {
		expect(() => Program.create({ id: " " as UUID, name: "A" })).toThrow(
			ArgumentInvalidError,
		);
	});

	it("CAT-PRG-CRT-003 throws when name is empty", () => {
		expect(() => Program.create({ id: uuid("5"), name: " " })).toThrow(
			ArgumentInvalidError,
		);
	});

	it("CAT-PRG-REN-001 rename updates the name and trims", () => {
		const p = Program.create({ id: uuid("5"), name: "A" });
		p.rename("  Nuevo Programa  ");
		expect(p.name).toBe("Nuevo Programa");
	});

	it("CAT-PRG-REN-002 rename throws on empty", () => {
		const p = Program.create({ id: uuid("5"), name: "A" });
		expect(() => p.rename(" ")).toThrow(ArgumentInvalidError);
	});
});
