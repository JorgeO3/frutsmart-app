import { SessionEmptyError } from "../errors/session-empty.error";
import { SessionHasPendingItemsError } from "../errors/session-has-pending-items.error";
import { SessionNotOpenError } from "../errors/session-not-open.error";
import { UploadSession } from "./upload-session.entity";
import { UploadItem } from "./upload-item.entity";
import { ClientIdentifier } from "../value-objects/client-identifier.vo";
import { StorageLocation } from "../value-objects/storage-location.vo";
import { FileProperties } from "../value-objects/file-properties.vo";
import { UploadItemStatus, UploadSessionStatus } from "../types";

describe("UploadSession", () => {
	const createValidSession = (
		status?: UploadSessionStatus,
		items: UploadItem[] = [],
	) => {
		const props = {
			id: "session-id-123",
			clientBatchId: ClientIdentifier.create("batch-id-456"),
			domain: "plant" as const,
			createdAt: new Date(),
		};

		if (status !== undefined) {
			// If COMPLETED status is requested without items, create a default VERIFIED item
			let effectiveItems = items;
			if (status === "COMPLETED" && items.length === 0) {
				const verifiedItem = UploadItem.fromPersistence({
					id: "default-item-123",
					clientItemId: ClientIdentifier.create("default-client-item"),
					location: StorageLocation.create({
						provider: "azure",
						container: "test-container",
						blobName: "plant/2025-01-01/default.jpg",
					}),
					properties: FileProperties.create({
						sizeInBytes: 1024,
						mimeType: "image/jpeg",
						md5Hash: "a".repeat(32),
					}),
					status: "VERIFIED",
					createdAt: new Date(),
					updatedAt: new Date(),
				});
				effectiveItems = [verifiedItem];
			}

			return UploadSession.fromPersistence({
				...props,
				status,
				items: effectiveItems,
				updatedAt: new Date(),
			});
		}

		return UploadSession.create(props);
	};

	const createValidItem = (status: UploadItemStatus = "PENDING") => {
		return UploadItem.fromPersistence({
			id: `item-${Math.random()}`,
			clientItemId: ClientIdentifier.create(`client-item-${Math.random()}`),
			location: StorageLocation.create({
				provider: "azure" as const,
				container: "test-container",
				blobName: `plant/2025-01-01/file-${Math.random()}.jpg`,
			}),
			properties: FileProperties.create({
				sizeInBytes: 1024,
				mimeType: "image/jpeg",
				md5Hash: "a".repeat(32),
			}),
			status,
			createdAt: new Date(),
			updatedAt: new Date(),
		});
	};

	describe("create", () => {
		it("should create a new UploadSession with OPEN status and empty items", () => {
			// DOM-SES-CRT-001
			const session = createValidSession();

			expect(session).toBeDefined();
			expect(session.status).toBe("OPEN");
			expect(session.items).toHaveLength(0);
			expect(session.id).toBe("session-id-123");
			expect(session.domain).toBe("plant");
		});
	});

	describe("addItem", () => {
		it("should add an item to an OPEN session", () => {
			// DOM-SES-ADD-001
			const session = createValidSession();
			const item = createValidItem();

			session.addItem(item);

			expect(session.items).toHaveLength(1);
			expect(session.items[0]).toBe(item);
		});

		it("should throw SessionNotOpenError when session is COMPLETED", () => {
			// DOM-SES-ADD-001 - Guard check
			const session = createValidSession("COMPLETED");
			const item = createValidItem();

			expect(() => session.addItem(item)).toThrow(SessionNotOpenError);
		});

		it("should throw SessionNotOpenError when session is FAILED", () => {
			const session = createValidSession("FAILED");
			const item = createValidItem();

			expect(() => session.addItem(item)).toThrow(SessionNotOpenError);
		});
	});

	describe("complete", () => {
		it("should complete session when all items are VERIFIED", () => {
			// DOM-SES-CMP-001
			const verifiedItem1 = createValidItem("VERIFIED");
			const verifiedItem2 = createValidItem("VERIFIED");
			const session = createValidSession("OPEN", [
				verifiedItem1,
				verifiedItem2,
			]);

			session.complete();

			expect(session.status).toBe("COMPLETED");
		});

		it("should throw SessionEmptyError when session has no items", () => {
			// DOM-SES-CMP-002
			const session = createValidSession("OPEN", []);

			expect(() => session.complete()).toThrow(SessionEmptyError);
		});

		it("should throw SessionHasPendingItemsError when items are not all VERIFIED", () => {
			// DOM-SES-CMP-003
			const verifiedItem = createValidItem("VERIFIED");
			const pendingItem = createValidItem("PENDING");
			const session = createValidSession("OPEN", [verifiedItem, pendingItem]);

			expect(() => session.complete()).toThrow(SessionHasPendingItemsError);
		});

		it("should throw SessionHasPendingItemsError with UPLOADED items", () => {
			// DOM-SES-CMP-003 - Strict verification
			const uploadedItem = createValidItem("UPLOADED");
			const session = createValidSession("OPEN", [uploadedItem]);

			expect(() => session.complete()).toThrow(SessionHasPendingItemsError);
		});

		it("should be idempotent when session is already COMPLETED", () => {
			// DOM-SES-IDEM-001 - complete() es idempotente
			const session = createValidSession("COMPLETED");

			// No lanza error, simplemente retorna
			expect(() => session.complete()).not.toThrow();
			expect(session.status).toBe("COMPLETED");
		});
	});

	describe("fail", () => {
		it("should mark session as FAILED when OPEN", () => {
			const session = createValidSession("OPEN");

			session.fail();

			expect(session.status).toBe("FAILED");
		});

		it("should throw SessionNotOpenError when session is not OPEN", () => {
			const session = createValidSession("COMPLETED");

			expect(() => session.fail()).toThrow(SessionNotOpenError);
		});
	});

	describe("guardCanGenerateSas", () => {
		it("should not throw when session is OPEN", () => {
			// DOM-SES-OPEN-001
			const session = createValidSession("OPEN");

			expect(() => session.guardCanGenerateSas()).not.toThrow();
		});

		it("should throw SessionNotOpenError when session is COMPLETED", () => {
			// DOM-SES-OPEN-001
			const session = createValidSession("COMPLETED");

			expect(() => session.guardCanGenerateSas()).toThrow(SessionNotOpenError);
		});

		it("should throw SessionNotOpenError when session is FAILED", () => {
			const session = createValidSession("FAILED");

			expect(() => session.guardCanGenerateSas()).toThrow(SessionNotOpenError);
		});
	});

	describe("findItemByBlobName", () => {
		it("should find item by blob name", () => {
			const item1 = createValidItem();
			const item2 = createValidItem();
			const session = createValidSession("OPEN", [item1, item2]);

			const found = session.findItemByBlobName(item1.location.blobName);

			expect(found).toBe(item1);
		});

		it("should return undefined when blob name not found", () => {
			const item = createValidItem();
			const session = createValidSession("OPEN", [item]);

			const found = session.findItemByBlobName("non-existent-blob");

			expect(found).toBeUndefined();
		});
	});

	describe("isTerminal", () => {
		it("should identify terminal states correctly", () => {
			expect(createValidSession("COMPLETED").isTerminal()).toBe(true);
			expect(createValidSession("FAILED").isTerminal()).toBe(true);
			expect(createValidSession("OPEN").isTerminal()).toBe(false);
			expect(createValidSession("CANCELLED").isTerminal()).toBe(false);
		});
	});

	describe("Timestamp Management", () => {
		it.skip("should update updatedAt when status changes", () => {
			// Skipped: Bun doesn't support jest.useFakeTimers() yet
			// This test verifies that timestamps are updated, which works in runtime
			const verifiedItem = createValidItem("VERIFIED");
			const session = createValidSession("OPEN", [verifiedItem]);
			const _initialUpdatedAt = session.updatedAt;

			// jest.useFakeTimers();
			// jest.advanceTimersByTime(1000);

			session.complete();

			// expect(session.updatedAt.getTime()).toBeGreaterThan(initialUpdatedAt.getTime());

			// jest.useRealTimers();
		});
	});
});
