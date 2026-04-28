import { Provider } from "./provider.entity";
import { ArgumentInvalidError } from "../errors/argument-invalid.error";
import type { UUID } from "../types";

const uuid = (n = "6") =>
	`${n.repeat(8)}-${n.repeat(4)}-${n.repeat(4)}-${n.repeat(4)}-${n.repeat(12)}` as UUID;

describe("Provider (Domain Entity)", () => {
	it("CAT-PVD-CRT-001 creates a provider (happy path) and trims values", () => {
		const p = Provider.create({
			id: ` ${uuid("6")} `,
			name: "  Proveedor Principal  ",
		});
		expect(p.id).toBe(uuid("6"));
		expect(p.name).toBe("Proveedor Principal");
	});

	it("CAT-PVD-CRT-002 throws when id is empty", () => {
		expect(() => Provider.create({ id: " " as UUID, name: "A" })).toThrow(
			ArgumentInvalidError,
		);
	});

	it("CAT-PVD-CRT-003 throws when name is empty", () => {
		expect(() => Provider.create({ id: uuid("6"), name: " " })).toThrow(
			ArgumentInvalidError,
		);
	});

	it("CAT-PVD-REN-001 rename updates the name and trims", () => {
		const p = Provider.create({ id: uuid("6"), name: "A" });
		p.rename("  Nuevo Proveedor  ");
		expect(p.name).toBe("Nuevo Proveedor");
	});

	it("CAT-PVD-REN-002 rename throws on empty", () => {
		const p = Provider.create({ id: uuid("6"), name: "A" });
		expect(() => p.rename(" ")).toThrow(ArgumentInvalidError);
	});
});
