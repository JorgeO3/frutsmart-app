import { ArgumentInvalidError } from "../errors/argument-invalid.error";
import { StorageLocation } from "./storage-location.vo";

describe("StorageLocation", () => {
	describe("create", () => {
		it("should create a valid StorageLocation with all required fields", () => {
			// DOM-VO-LOC-001 - Valid creation
			const props = {
				provider: "azure" as const,
				container: "test-container",
				blobName: "path/to/file.jpg",
			};
			const location = StorageLocation.create(props);

			expect(location).toBeDefined();
			expect(location.provider).toBe("azure");
			expect(location.container).toBe("test-container");
			expect(location.blobName).toBe("path/to/file.jpg");
		});

		it("should throw ArgumentInvalidError when container is empty", () => {
			// DOM-VO-LOC-002 - Empty container
			const props = {
				provider: "azure" as const,
				container: "",
				blobName: "file.jpg",
			};

			expect(() => StorageLocation.create(props)).toThrow(ArgumentInvalidError);
			expect(() => StorageLocation.create(props)).toThrow(
				"Invalid storage container.",
			);
		});

		it("should throw ArgumentInvalidError when container is only whitespace", () => {
			// DOM-VO-LOC-003 - Whitespace container
			const props = {
				provider: "azure" as const,
				container: "   ",
				blobName: "file.jpg",
			};

			expect(() => StorageLocation.create(props)).toThrow(ArgumentInvalidError);
			expect(() => StorageLocation.create(props)).toThrow(
				"Invalid storage container.",
			);
		});

		it("should throw ArgumentInvalidError when blobName is empty", () => {
			// DOM-VO-LOC-004 - Empty blobName
			const props = {
				provider: "azure" as const,
				container: "container",
				blobName: "",
			};

			expect(() => StorageLocation.create(props)).toThrow(ArgumentInvalidError);
			expect(() => StorageLocation.create(props)).toThrow(
				"Invalid storage blobName.",
			);
		});

		it("should throw ArgumentInvalidError when blobName is only whitespace", () => {
			// DOM-VO-LOC-005 - Whitespace blobName
			const props = {
				provider: "azure" as const,
				container: "container",
				blobName: "   ",
			};

			expect(() => StorageLocation.create(props)).toThrow(ArgumentInvalidError);
			expect(() => StorageLocation.create(props)).toThrow(
				"Invalid storage blobName.",
			);
		});

		it("should throw when blobName has unsafe path patterns (starts/ends with /, //, \\)", () => {
			// DOM-VO-LOC-006 - Unsafe path patterns
			const base = { provider: "azure" as const, container: "c" };

			const cases = [
				{ ...base, blobName: "/file.jpg" },
				{ ...base, blobName: "file.jpg/" },
				{ ...base, blobName: "a//b.jpg" },
				{ ...base, blobName: "a\\b.jpg" },
			];

			for (const props of cases) {
				expect(() => StorageLocation.create(props)).toThrow(
					ArgumentInvalidError,
				);
				expect(() => StorageLocation.create(props)).toThrow(
					"blobName path is unsafe.",
				);
			}
		});

		it("should throw when blobName attempts traversal (.. or /../ or /./)", () => {
			// DOM-VO-LOC-007 - Traversal attempts
			const base = { provider: "azure" as const, container: "c" };

			const cases = [
				{ ...base, blobName: "../file.jpg" },
				{ ...base, blobName: "a/../b.jpg" },
				{ ...base, blobName: "a/./b.jpg" },
				{ ...base, blobName: "a..b.jpg" }, // bloqueado por política (..)
			];

			for (const props of cases) {
				expect(() => StorageLocation.create(props)).toThrow(
					ArgumentInvalidError,
				);
				expect(() => StorageLocation.create(props)).toThrow(
					"blobName path is unsafe.",
				);
			}
		});
	});

	describe("equals", () => {
		it("should return true when all properties match", () => {
			const props = {
				provider: "azure" as const,
				container: "test-container",
				blobName: "path/to/file.jpg",
			};
			const location1 = StorageLocation.create(props);
			const location2 = StorageLocation.create(props);

			expect(location1.equals(location2)).toBe(true);
		});

		it("should return false when providers differ", () => {
			const location1 = StorageLocation.create({
				provider: "azure",
				container: "container",
				blobName: "file.jpg",
			});
			const location2 = StorageLocation.create({
				provider: "s3",
				container: "container",
				blobName: "file.jpg",
			});

			expect(location1.equals(location2)).toBe(false);
		});

		it("should return false when comparing with null or undefined", () => {
			const location = StorageLocation.create({
				provider: "azure",
				container: "container",
				blobName: "file.jpg",
			});

			expect(location.equals(null as unknown as StorageLocation)).toBe(false);
			expect(location.equals(undefined)).toBe(false);
		});
	});
});
