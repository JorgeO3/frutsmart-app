// src/modules/evaluation/domain/entities/photo.entity.spec.ts
import { ArgumentInvalidError } from "../errors/argument-invalid.error";
import type { PhotoRole } from "../types";
import { Photo } from "./photo.entity";

describe("Photo (Domain Entity)", () => {
	const VALID_UUID = "11111111-1111-4111-8111-111111111111";
	const STEP_ID = "22222222-2222-4222-8222-222222222222";
	const UPLOAD_ITEM_ID = "33333333-3333-4333-8333-333333333333";

	const validRole: PhotoRole = "raw";

	it("should create a valid Photo with required fields (default createdAt)", () => {
		const photo = Photo.create({
			id: VALID_UUID,
			stepId: STEP_ID,
			role: validRole,
			uploadItemId: UPLOAD_ITEM_ID,
		});

		expect(photo).toBeDefined();
		expect(photo.id).toBe(VALID_UUID);
		expect(photo.stepId).toBe(STEP_ID);
		expect(photo.role).toBe(validRole);
		expect(photo.uploadItemId).toBe(UPLOAD_ITEM_ID);
		expect(photo.createdAt).toBeInstanceOf(Date);
	});

	it("should use provided createdAt when given", () => {
		const ts = new Date("2024-11-05T10:30:00.000Z");
		const photo = Photo.create({
			id: VALID_UUID,
			stepId: STEP_ID,
			role: "segmented",
			uploadItemId: UPLOAD_ITEM_ID,
			createdAt: ts,
		});

		expect(photo.createdAt.toISOString()).toBe(ts.toISOString());
	});

	it("should throw when id is missing", () => {
		expect(() =>
			Photo.create({
				stepId: STEP_ID,
				role: validRole,
				uploadItemId: UPLOAD_ITEM_ID,
			} as unknown as Photo),
		).toThrow(ArgumentInvalidError);
		expect(() =>
			Photo.create({
				id: undefined,
				stepId: STEP_ID,
				role: validRole,
				uploadItemId: UPLOAD_ITEM_ID,
			} as unknown as Photo),
		).toThrow("Photo.id is required.");
	});

	it("should throw when stepId is missing", () => {
		expect(() =>
			Photo.create({
				id: VALID_UUID,
				role: validRole,
				uploadItemId: UPLOAD_ITEM_ID,
			} as unknown as Photo),
		).toThrow(ArgumentInvalidError);
		expect(() =>
			Photo.create({
				id: VALID_UUID,
				stepId: undefined,
				role: validRole,
				uploadItemId: UPLOAD_ITEM_ID,
			} as unknown as Photo),
		).toThrow("Photo.stepId is required.");
	});

	it("should throw when uploadItemId is missing", () => {
		expect(() =>
			Photo.create({
				id: VALID_UUID,
				stepId: STEP_ID,
				role: validRole,
			} as unknown as Photo),
		).toThrow(ArgumentInvalidError);
		expect(() =>
			Photo.create({
				id: VALID_UUID,
				stepId: STEP_ID,
				role: validRole,
				uploadItemId: undefined,
			} as unknown as Photo),
		).toThrow("Photo.uploadItemId is required.");
	});

	it("should throw when role is invalid", () => {
		expect(() =>
			Photo.create({
				id: VALID_UUID,
				stepId: STEP_ID,
				role: "thumbnail",
				uploadItemId: UPLOAD_ITEM_ID,
			} as unknown as Photo),
		).toThrow(ArgumentInvalidError);

		expect(() =>
			Photo.create({
				id: VALID_UUID,
				stepId: STEP_ID,
				role: "thumbnail",
				uploadItemId: UPLOAD_ITEM_ID,
			} as unknown as Photo),
		).toThrow("Photo.role must be one of: raw, segmented, cropped");
	});

	it("should expose values through getters (immutability outward)", () => {
		const createdAt = new Date();
		const photo = Photo.create({
			id: VALID_UUID,
			stepId: STEP_ID,
			role: "cropped",
			uploadItemId: UPLOAD_ITEM_ID,
			createdAt,
		});

		expect(photo.id).toBe(VALID_UUID);
		expect(photo.stepId).toBe(STEP_ID);
		expect(photo.role).toBe("cropped");
		expect(photo.uploadItemId).toBe(UPLOAD_ITEM_ID);
		expect(photo.createdAt).toBe(createdAt);
	});
});
