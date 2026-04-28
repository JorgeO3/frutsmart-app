import { SubProvider } from "./sub-provider.entity";
import { ArgumentInvalidError } from "../errors/argument-invalid.error";
import type { UUID } from "../types";

const uuid = (n = "7") =>
	`${n.repeat(8)}-${n.repeat(4)}-${n.repeat(4)}-${n.repeat(4)}-${n.repeat(12)}` as UUID;

describe("SubProvider (Domain Entity)", () => {
	it("CAT-SPV-CRT-001 creates a sub-provider (happy path) and trims values", () => {
		const sp = SubProvider.create({
			id: ` ${uuid("7")} `,
			name: "  Sub Proveedor A  ",
			providerId: ` ${uuid("8")} `,
		});
		expect(sp.id).toBe(uuid("7"));
		expect(sp.name).toBe("Sub Proveedor A");
		expect(sp.providerId).toBe(uuid("8"));
	});

	it("CAT-SPV-CRT-002 throws when id is empty", () => {
		expect(() =>
			SubProvider.create({ id: " " as UUID, name: "A", providerId: uuid("8") }),
		).toThrow(ArgumentInvalidError);
	});

	it("CAT-SPV-CRT-003 throws when name is empty", () => {
		expect(() =>
			SubProvider.create({ id: uuid("7"), name: " ", providerId: uuid("8") }),
		).toThrow(ArgumentInvalidError);
	});

	it("CAT-SPV-CRT-004 throws when providerId is empty", () => {
		expect(() =>
			SubProvider.create({
				id: uuid("7"),
				name: "A",
				providerId: " " as UUID,
			}),
		).toThrow(ArgumentInvalidError);
	});

	it("CAT-SPV-REN-001 rename updates the name and trims", () => {
		const sp = SubProvider.create({
			id: uuid("7"),
			name: "A",
			providerId: uuid("8"),
		});
		sp.rename("  Nuevo Sub Proveedor  ");
		expect(sp.name).toBe("Nuevo Sub Proveedor");
	});

	it("CAT-SPV-REN-002 rename throws on empty", () => {
		const sp = SubProvider.create({
			id: uuid("7"),
			name: "A",
			providerId: uuid("8"),
		});
		expect(() => sp.rename(" ")).toThrow(ArgumentInvalidError);
	});

	it("CAT-SPV-MOV-001 moveToProvider updates providerId and trims", () => {
		const sp = SubProvider.create({
			id: uuid("7"),
			name: "A",
			providerId: uuid("8"),
		});
		sp.moveToProvider(` ${uuid("9")} `);
		expect(sp.providerId).toBe(uuid("9"));
	});

	it("CAT-SPV-MOV-002 moveToProvider throws on empty", () => {
		const sp = SubProvider.create({
			id: uuid("7"),
			name: "A",
			providerId: uuid("8"),
		});
		expect(() => sp.moveToProvider(" " as UUID)).toThrow(ArgumentInvalidError);
	});
});
