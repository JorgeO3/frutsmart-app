import { ArgumentInvalidError } from "../errors/argument-invalid.error";
import { FileProperties } from "./file-properties.vo";

describe("FileProperties", () => {
	const VALID_MD5 = "abcdef0123456789abcdef0123456789"; // 32 hex
	const VALID_MIME = "image/jpeg";

	describe("create", () => {
		it("should create valid FileProperties with required fields", () => {
			// DOM-VO-PRP-001 - Valid creation
			const props = {
				sizeInBytes: 1024,
				mimeType: VALID_MIME,
				md5Hash: VALID_MD5,
			};
			const fileProps = FileProperties.create(props);

			expect(fileProps).toBeDefined();
			expect(fileProps.sizeInBytes).toBe(1024);
			expect(fileProps.mimeType).toBe(VALID_MIME);
			expect(fileProps.md5Hash).toBe(VALID_MD5);
		});

		it("should throw when sizeInBytes is negative", () => {
			// DOM-VO-PRP-004 - Negative size
			const props = {
				sizeInBytes: -1,
				mimeType: VALID_MIME,
				md5Hash: VALID_MD5,
			};
			expect(() => FileProperties.create(props)).toThrow(ArgumentInvalidError);
			expect(() => FileProperties.create(props)).toThrow(
				"sizeInBytes must be a positive integer (> 0).",
			);
		});

		it("should throw when sizeInBytes is zero", () => {
			// DOM-VO-PRP-005 - Zero size not allowed
			const props = {
				sizeInBytes: 0,
				mimeType: VALID_MIME,
				md5Hash: VALID_MD5,
			};
			expect(() => FileProperties.create(props)).toThrow(ArgumentInvalidError);
			expect(() => FileProperties.create(props)).toThrow(
				"sizeInBytes must be a positive integer (> 0).",
			);
		});

		it("should throw when MD5 hash is invalid (not 32 hex chars)", () => {
			// DOM-VO-PRP-006 - Invalid MD5 format
			expect(() =>
				FileProperties.create({
					sizeInBytes: 100,
					mimeType: VALID_MIME,
					md5Hash: "invalid",
				}),
			).toThrow(ArgumentInvalidError);

			expect(() =>
				FileProperties.create({
					sizeInBytes: 100,
					mimeType: VALID_MIME,
					md5Hash: "a".repeat(31),
				}),
			).toThrow(ArgumentInvalidError);

			expect(() =>
				FileProperties.create({
					sizeInBytes: 100,
					mimeType: VALID_MIME,
					md5Hash: "z".repeat(32),
				}),
			).toThrow(ArgumentInvalidError);
		});

		it("should accept both uppercase and lowercase MD5 hashes", () => {
			// DOM-VO-PRP-007 - Case-insensitive MD5
			const lowerMd5 = "abcdef0123456789abcdef0123456789";
			const upperMd5 = "ABCDEF0123456789ABCDEF0123456789";
			const mixedMd5 = "aAbBcCdDeEfF0123456789abcdef0123";

			expect(() =>
				FileProperties.create({
					sizeInBytes: 100,
					mimeType: VALID_MIME,
					md5Hash: lowerMd5,
				}),
			).not.toThrow();
			expect(() =>
				FileProperties.create({
					sizeInBytes: 100,
					mimeType: VALID_MIME,
					md5Hash: upperMd5,
				}),
			).not.toThrow();
			expect(() =>
				FileProperties.create({
					sizeInBytes: 100,
					mimeType: VALID_MIME,
					md5Hash: mixedMd5,
				}),
			).not.toThrow();
		});

		it("should throw when mimeType is not RFC-like", () => {
			// DOM-VO-PRP-008 - MIME validation
			const badMimes = [
				"",
				"image",
				"image/",
				"/jpeg",
				"image\\jpeg",
				" IMAGE/JPEG ",
			];
			for (const m of badMimes) {
				expect(() =>
					FileProperties.create({
						sizeInBytes: 10,
						mimeType: m as string,
						md5Hash: VALID_MD5,
					}),
				).toThrow(ArgumentInvalidError);
			}
		});
	});

	describe("equals", () => {
		it("should return true when all properties match", () => {
			const props = {
				sizeInBytes: 1024,
				mimeType: VALID_MIME,
				md5Hash: VALID_MD5,
			};
			const file1 = FileProperties.create(props);
			const file2 = FileProperties.create(props);

			expect(file1.equals(file2)).toBe(true);
		});

		it("should return false when sizes differ", () => {
			const file1 = FileProperties.create({
				sizeInBytes: 1024,
				mimeType: VALID_MIME,
				md5Hash: VALID_MD5,
			});
			const file2 = FileProperties.create({
				sizeInBytes: 2048,
				mimeType: VALID_MIME,
				md5Hash: VALID_MD5,
			});

			expect(file1.equals(file2)).toBe(false);
		});

		it("should return false when comparing with null or undefined", () => {
			const file = FileProperties.create({
				sizeInBytes: 1024,
				mimeType: VALID_MIME,
				md5Hash: VALID_MD5,
			});

			expect(file.equals(null as unknown as FileProperties)).toBe(false);
			expect(file.equals(undefined)).toBe(false);
		});
	});
});
