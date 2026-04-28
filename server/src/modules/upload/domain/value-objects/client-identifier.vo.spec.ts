import { ArgumentInvalidError } from "../errors/argument-invalid.error";
import { ClientIdentifier } from "./client-identifier.vo";

describe("ClientIdentifier", () => {
	describe("create", () => {
		it("should create a valid ClientIdentifier with a non-empty value", () => {
			// DOM-VO-CID-001 - Valid creation
			const value = "test-client-id-123";
			const clientId = ClientIdentifier.create(value);

			expect(clientId).toBeDefined();
			expect(clientId.value).toBe(value);
		});

		it("should throw ArgumentInvalidError when value is empty string", () => {
			// DOM-VO-CID-001 - Empty value validation
			expect(() => ClientIdentifier.create("")).toThrow(ArgumentInvalidError);
			expect(() => ClientIdentifier.create("")).toThrow(
				"ClientIdentifier value cannot be empty.",
			);
		});

		it("should throw ArgumentInvalidError when value is only whitespace", () => {
			// DOM-VO-CID-001 - Whitespace-only validation
			expect(() => ClientIdentifier.create("   ")).toThrow(
				ArgumentInvalidError,
			);
			expect(() => ClientIdentifier.create("\t\n")).toThrow(
				ArgumentInvalidError,
			);
		});
	});

	describe("equals", () => {
		it("should return true when comparing two ClientIdentifiers with the same value", () => {
			const value = "same-id";
			const clientId1 = ClientIdentifier.create(value);
			const clientId2 = ClientIdentifier.create(value);

			expect(clientId1.equals(clientId2)).toBe(true);
		});

		it("should return false when comparing ClientIdentifiers with different values", () => {
			const clientId1 = ClientIdentifier.create("id-1");
			const clientId2 = ClientIdentifier.create("id-2");

			expect(clientId1.equals(clientId2)).toBe(false);
		});

		it("should return false when comparing with null or undefined", () => {
			const clientId = ClientIdentifier.create("test-id");

			expect(clientId.equals(null as unknown as ClientIdentifier)).toBe(false);
			expect(clientId.equals(undefined)).toBe(false);
		});
	});
});
