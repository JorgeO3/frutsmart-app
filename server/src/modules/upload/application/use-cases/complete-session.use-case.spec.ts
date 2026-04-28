import { Test, type TestingModule } from "@nestjs/testing";
import { CompleteSessionUseCase } from "./complete-session.use-case";
import {
	CompleteSessionMapper,
	COMPLETE_SESSION_MAPPER,
} from "../mappers/complete-session.mapper";
import { LOGGER } from "../ports/logger.port";
import { TRANSACTION_MANAGER } from "../ports/transaction-manager.port";
import { UPLOAD_SESSIONS_REPOSITORY } from "../ports/repositories/upload-sessions.repo.port";
import { BLOB_STORAGE } from "../ports/blob-storage.port";
import {
	MockLogger,
	MockTransactionManager,
	MockUploadSessionsRepository,
	MockBlobStorage,
} from "../../test/mocks";
import {
	makeUploadSession,
	makeUploadItem,
	randomUUID,
} from "../../test/factories";
import { CompleteSessionInput } from "../dto/complete-session/complete-session.input";
import { SessionNotFoundError } from "../errors/session-not-found.error";

describe("CompleteSessionUseCase", () => {
	let useCase: CompleteSessionUseCase;
	let mockLogger: MockLogger;
	let mockTransactionManager: MockTransactionManager;
	let mockSessionRepo: MockUploadSessionsRepository;
	let mockBlobStorage: MockBlobStorage;
	// let mapper: CompleteSessionMapper;

	beforeEach(async () => {
		mockLogger = new MockLogger();
		mockTransactionManager = new MockTransactionManager();
		mockSessionRepo = new MockUploadSessionsRepository();
		mockBlobStorage = new MockBlobStorage();

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				CompleteSessionUseCase,
				{ provide: COMPLETE_SESSION_MAPPER, useClass: CompleteSessionMapper },
				{ provide: LOGGER, useValue: mockLogger },
				{ provide: TRANSACTION_MANAGER, useValue: mockTransactionManager },
				{ provide: UPLOAD_SESSIONS_REPOSITORY, useValue: mockSessionRepo },
				{ provide: BLOB_STORAGE, useValue: mockBlobStorage },
			],
		}).compile();

		useCase = module.get<CompleteSessionUseCase>(CompleteSessionUseCase);
		// mapper = module.get<CompleteSessionMapper>(COMPLETE_SESSION_MAPPER);
	});
	describe("execute", () => {
		it("should complete session with verified items when verifyAndPromote is true", async () => {
			// APP-COM-VRF-001 - Verify and complete
			const uploadedItem = makeUploadItem({
				status: "UPLOADED",
				md5Hash: "a".repeat(32),
			});
			const session = makeUploadSession({
				status: "OPEN",
				items: [uploadedItem],
			});

			const input: CompleteSessionInput = {
				sessionId: session.id,
				verifyAndPromote: true,
				failOnIncomplete: false,
			};

			mockSessionRepo.findById.mockResolvedValue(session);
			mockSessionRepo.save.mockResolvedValue(undefined);
			mockBlobStorage.getObjectMetadata.mockResolvedValue({
				exists: true,
				md5Hash: "a".repeat(32),
				sizeInBytes: 1024,
			});

			const result = await useCase.execute(input);

			expect(result.finalStatus).toBe("COMPLETED");
			expect(result.results[0].finalStatus).toBe("VERIFIED");
			expect(mockBlobStorage.getObjectMetadata).toHaveBeenCalledTimes(1);
		});

		it("should mark item as FAILED when MD5 does not match", async () => {
			// APP-COM-VRF-002 - MD5 mismatch
			const uploadedItem = makeUploadItem({
				status: "UPLOADED",
				md5Hash: "a".repeat(32),
			});
			const session = makeUploadSession({
				status: "OPEN",
				items: [uploadedItem],
			});

			const input: CompleteSessionInput = {
				sessionId: session.id,
				verifyAndPromote: true,
				failOnIncomplete: false,
			};

			mockSessionRepo.findById.mockResolvedValue(session);
			mockSessionRepo.save.mockResolvedValue(undefined);
			mockBlobStorage.getObjectMetadata.mockResolvedValue({
				exists: true,
				md5Hash: "b".repeat(32), // Different MD5
				sizeInBytes: 1024,
			});

			const result = await useCase.execute(input);

			expect(result.results[0].finalStatus).toBe("FAILED");
			expect(result.results[0].error).toBeDefined();
		});

		it("should mark session as FAILED when failOnIncomplete is true and items failed", async () => {
			// APP-COM-FLG-001 - failOnIncomplete=true
			const uploadedItem = makeUploadItem({
				status: "UPLOADED",
				md5Hash: "a".repeat(32),
			});
			const session = makeUploadSession({
				status: "OPEN",
				items: [uploadedItem],
			});

			const input: CompleteSessionInput = {
				sessionId: session.id,
				verifyAndPromote: true,
				failOnIncomplete: true,
			};

			mockSessionRepo.findById.mockResolvedValue(session);
			mockSessionRepo.save.mockResolvedValue(undefined);
			mockBlobStorage.getObjectMetadata.mockResolvedValue({
				exists: false, // Blob not found
			});

			const result = await useCase.execute(input);

			expect(result.finalStatus).toBe("FAILED");
			expect(result.results[0].finalStatus).toBe("FAILED");
		});

		it("should leave session OPEN when failOnIncomplete is false but items cannot complete", async () => {
			// APP-COM-FLG-002 - failOnIncomplete=false con fallas => sesión queda OPEN
			const item1 = makeUploadItem({
				status: "UPLOADED",
				md5Hash: "a".repeat(32),
			});
			const item2 = makeUploadItem({
				status: "UPLOADED",
				md5Hash: "b".repeat(32),
			});
			const session = makeUploadSession({
				status: "OPEN",
				items: [item1, item2],
			});

			const input: CompleteSessionInput = {
				sessionId: session.id,
				verifyAndPromote: true,
				failOnIncomplete: false,
			};

			mockSessionRepo.findById.mockResolvedValue(session);
			mockSessionRepo.save.mockResolvedValue(undefined);
			mockBlobStorage.getObjectMetadata
				.mockResolvedValueOnce({
					exists: true,
					md5Hash: "a".repeat(32),
					sizeInBytes: 1024,
				})
				.mockResolvedValueOnce({ exists: false }); // el segundo ítem falla

			const result = await useCase.execute(input);

			// Con política laxa, la sesión no se completa ni falla: queda OPEN
			expect(result.finalStatus).toBe("OPEN");
			expect(result.results.some((i) => i.finalStatus === "VERIFIED")).toBe(
				true,
			);
			expect(result.results.some((i) => i.finalStatus === "FAILED")).toBe(true);
			expect(mockSessionRepo.save).toHaveBeenCalledTimes(1);
		});

		it("should process only specified items when onlyClientItemIds is provided", async () => {
			// APP-COM-SUB-001 - Subset processing
			const item1 = makeUploadItem({
				clientItemId: "client-1",
				status: "UPLOADED",
				md5Hash: "a".repeat(32),
			});
			const item2 = makeUploadItem({
				clientItemId: "client-2",
				status: "UPLOADED",
				md5Hash: "b".repeat(32),
			});
			const session = makeUploadSession({
				status: "OPEN",
				items: [item1, item2],
			});

			const input: CompleteSessionInput = {
				sessionId: session.id,
				verifyAndPromote: true,
				failOnIncomplete: false,
				onlyClientItemIds: ["client-1"], // Only process item1
			};

			mockSessionRepo.findById.mockResolvedValue(session);
			mockSessionRepo.save.mockResolvedValue(undefined);
			mockBlobStorage.getObjectMetadata.mockResolvedValue({
				exists: true,
				md5Hash: "a".repeat(32),
				sizeInBytes: 1024,
			});

			const result = await useCase.execute(input);

			expect(mockBlobStorage.getObjectMetadata).toHaveBeenCalledTimes(1);
			expect(result.results).toHaveLength(1);
			expect(result.results[0].clientItemId).toBe("client-1");
		});

		it("should skip verification when verifyAndPromote is false", async () => {
			// APP-COM-NV-001 - No verification
			const item = makeUploadItem({ status: "UPLOADED" });
			const session = makeUploadSession({ status: "OPEN", items: [item] });

			const input: CompleteSessionInput = {
				sessionId: session.id,
				verifyAndPromote: false,
				failOnIncomplete: false,
			};

			mockSessionRepo.findById.mockResolvedValue(session);
			mockSessionRepo.save.mockResolvedValue(undefined);

			await useCase.execute(input);

			expect(mockBlobStorage.getObjectMetadata).not.toHaveBeenCalled();
		});

		it("should throw SessionNotFoundError when session does not exist", async () => {
			// APP-COM-404-001 - Session not found
			const input: CompleteSessionInput = {
				sessionId: randomUUID(),
				verifyAndPromote: true,
				failOnIncomplete: false,
			};

			mockSessionRepo.findById.mockResolvedValue(null);

			await expect(useCase.execute(input)).rejects.toThrow(
				SessionNotFoundError,
			);
		});
		it("should handle Azure storage errors gracefully", async () => {
			// APP-COM-AZR-001 - Azure failure
			const uploadedItem = makeUploadItem({ status: "UPLOADED" });
			const session = makeUploadSession({
				status: "OPEN",
				items: [uploadedItem],
			});

			const input: CompleteSessionInput = {
				sessionId: session.id,
				verifyAndPromote: true,
				failOnIncomplete: false,
			};

			mockSessionRepo.findById.mockResolvedValue(session);
			mockSessionRepo.save.mockResolvedValue(undefined);
			mockBlobStorage.getObjectMetadata.mockRejectedValue(
				new Error("Azure connection timeout"),
			);

			const result = await useCase.execute(input);

			expect(result.results[0].finalStatus).toBe("FAILED");
			expect(result.results[0].error?.message).toContain(
				"Azure connection timeout",
			);
		});

		it("should wrap operations in a transaction", async () => {
			const item = makeUploadItem({ status: "UPLOADED" });
			const session = makeUploadSession({ status: "OPEN", items: [item] });

			const input: CompleteSessionInput = {
				sessionId: session.id,
				verifyAndPromote: false,
				failOnIncomplete: false,
			};

			mockSessionRepo.findById.mockResolvedValue(session);
			mockSessionRepo.save.mockResolvedValue(undefined);

			const runInTransactionSpy = jest.spyOn(
				mockTransactionManager,
				"runInTransaction",
			);

			await useCase.execute(input);

			expect(runInTransactionSpy).toHaveBeenCalledTimes(1);
		});

		// ===========================
		// Input Validation
		// ===========================

		it("APP-COM-VAL-UUID-001 should reject invalid sessionId format", async () => {
			const invalidInput: CompleteSessionInput = {
				sessionId: "not-a-uuid",
				verifyAndPromote: true,
				failOnIncomplete: true,
			};

			await expect(useCase.execute(invalidInput)).rejects.toThrow(
				"Invalid session ID format",
			);

			expect(mockSessionRepo.findById).not.toHaveBeenCalled();
		});

		// ===========================
		// Session State Guards
		// ===========================

		it("APP-COM-STS-SES-001 should reject completing a COMPLETED session", async () => {
			const completedSession = makeUploadSession({
				status: "COMPLETED",
				items: [],
			});

			const input: CompleteSessionInput = {
				sessionId: completedSession.id,
				verifyAndPromote: true,
				failOnIncomplete: true,
			};

			mockSessionRepo.findById.mockResolvedValue(completedSession);

			await expect(useCase.execute(input)).rejects.toThrow(); // SessionNotOpenError from guard
		});

		it("APP-COM-STS-SES-002 should reject completing a FAILED session", async () => {
			const failedSession = makeUploadSession({
				status: "FAILED",
				items: [],
			});

			const input: CompleteSessionInput = {
				sessionId: failedSession.id,
				verifyAndPromote: true,
				failOnIncomplete: true,
			};

			mockSessionRepo.findById.mockResolvedValue(failedSession);

			await expect(useCase.execute(input)).rejects.toThrow(); // SessionNotOpenError from guard
		});

		// ===========================
		// Empty Processing List
		// ===========================

		it("APP-COM-EMPTY-001 should handle empty processing list with failOnIncomplete=true", async () => {
			const session = makeUploadSession({
				status: "OPEN",
				items: [],
			});

			const input: CompleteSessionInput = {
				sessionId: session.id,
				verifyAndPromote: true,
				failOnIncomplete: true,
			};

			mockSessionRepo.findById.mockResolvedValue(session);
			mockSessionRepo.save.mockResolvedValue(undefined);

			const result = await useCase.execute(input);

			expect(result.finalStatus).toBe("FAILED");
			expect(result.results).toHaveLength(0);
			expect(mockBlobStorage.getObjectMetadata).not.toHaveBeenCalled();
			expect(mockLogger.warn).toHaveBeenCalledWith(
				"No items to process in complete session",
				expect.objectContaining({
					sessionId: session.id,
					totalItems: 0,
				}),
			);
		});

		it("APP-COM-EMPTY-002 should handle empty processing list with failOnIncomplete=false", async () => {
			const session = makeUploadSession({
				status: "OPEN",
				items: [],
			});

			const input: CompleteSessionInput = {
				sessionId: session.id,
				verifyAndPromote: true,
				failOnIncomplete: false,
			};

			mockSessionRepo.findById.mockResolvedValue(session);
			mockSessionRepo.save.mockResolvedValue(undefined);

			const result = await useCase.execute(input);

			expect(result.results).toHaveLength(0);
			expect(mockBlobStorage.getObjectMetadata).not.toHaveBeenCalled();
		});

		// ===========================
		// Subset (onlyClientItemIds)
		// ===========================

		it("APP-COM-SUB-002 should handle unknown clientItemIds in filter", async () => {
			const item1 = makeUploadItem({
				clientItemId: "client-1",
				status: "UPLOADED",
			});
			const session = makeUploadSession({
				status: "OPEN",
				items: [item1],
			});

			const input: CompleteSessionInput = {
				sessionId: session.id,
				verifyAndPromote: true,
				failOnIncomplete: true,
				onlyClientItemIds: ["unknown-id", "another-unknown"],
			};

			mockSessionRepo.findById.mockResolvedValue(session);
			mockSessionRepo.save.mockResolvedValue(undefined);

			const result = await useCase.execute(input);

			expect(result.finalStatus).toBe("FAILED");
			expect(result.results).toHaveLength(0);
			expect(mockBlobStorage.getObjectMetadata).not.toHaveBeenCalled();
			expect(mockLogger.warn).toHaveBeenCalledWith(
				"No items to process in complete session",
				expect.objectContaining({
					sessionId: session.id,
					requestedFilter: 2,
				}),
			);
		});

		it("APP-COM-SUB-003 should maintain stable order for subset results", async () => {
			const item1 = makeUploadItem({
				clientItemId: "client-1",
				status: "UPLOADED",
				md5Hash: "a".repeat(32),
			});
			const item2 = makeUploadItem({
				clientItemId: "client-2",
				status: "UPLOADED",
				md5Hash: "b".repeat(32),
			});
			const item3 = makeUploadItem({
				clientItemId: "client-3",
				status: "UPLOADED",
				md5Hash: "c".repeat(32),
			});

			const session = makeUploadSession({
				status: "OPEN",
				items: [item1, item2, item3],
			});

			const input: CompleteSessionInput = {
				sessionId: session.id,
				verifyAndPromote: true,
				failOnIncomplete: false,
				onlyClientItemIds: ["client-3", "client-1"], // Order should be preserved from session
			};

			mockSessionRepo.findById.mockResolvedValue(session);
			mockSessionRepo.save.mockResolvedValue(undefined);
			mockBlobStorage.getObjectMetadata
				.mockResolvedValueOnce({
					exists: true,
					md5Hash: "a".repeat(32),
					sizeInBytes: 1024,
				})
				.mockResolvedValueOnce({
					exists: true,
					md5Hash: "c".repeat(32),
					sizeInBytes: 2048,
				});

			const result = await useCase.execute(input);

			expect(result.results).toHaveLength(2);
			expect(result.results[0].clientItemId).toBe("client-1");
			expect(result.results[1].clientItemId).toBe("client-3");
			expect(mockBlobStorage.getObjectMetadata).toHaveBeenCalledTimes(2);
		});

		// ===========================
		// MD5 Verification
		// ===========================

		it("APP-COM-VRF-003 should mark item as FAILED when MD5 is missing", async () => {
			const uploadedItem = makeUploadItem({
				status: "UPLOADED",
				md5Hash: "a".repeat(32),
			});
			const session = makeUploadSession({
				status: "OPEN",
				items: [uploadedItem],
			});

			const input: CompleteSessionInput = {
				sessionId: session.id,
				verifyAndPromote: true,
				failOnIncomplete: false,
			};

			mockSessionRepo.findById.mockResolvedValue(session);
			mockSessionRepo.save.mockResolvedValue(undefined);
			mockBlobStorage.getObjectMetadata.mockResolvedValue({
				exists: true,
				sizeInBytes: 1024,
				// md5Hash is missing
			});

			const result = await useCase.execute(input);

			expect(result.results[0].finalStatus).toBe("FAILED");
			expect(result.results[0].error?.message).toContain(
				"MD5 not available for blob",
			);
		});

		it("APP-COM-VRF-004 should verify multiple items with all matching MD5", async () => {
			const item1 = makeUploadItem({
				status: "UPLOADED",
				md5Hash: "a".repeat(32),
			});
			const item2 = makeUploadItem({
				status: "UPLOADED",
				md5Hash: "b".repeat(32),
			});
			const item3 = makeUploadItem({
				status: "UPLOADED",
				md5Hash: "c".repeat(32),
			});

			const session = makeUploadSession({
				status: "OPEN",
				items: [item1, item2, item3],
			});

			const input: CompleteSessionInput = {
				sessionId: session.id,
				verifyAndPromote: true,
				failOnIncomplete: false,
			};

			mockSessionRepo.findById.mockResolvedValue(session);
			mockSessionRepo.save.mockResolvedValue(undefined);
			mockBlobStorage.getObjectMetadata
				.mockResolvedValueOnce({
					exists: true,
					md5Hash: "a".repeat(32),
					sizeInBytes: 1024,
				})
				.mockResolvedValueOnce({
					exists: true,
					md5Hash: "b".repeat(32),
					sizeInBytes: 2048,
				})
				.mockResolvedValueOnce({
					exists: true,
					md5Hash: "c".repeat(32),
					sizeInBytes: 3072,
				});

			const result = await useCase.execute(input);

			expect(result.finalStatus).toBe("COMPLETED");
			expect(result.results).toHaveLength(3);
			expect(result.results.every((r) => r.finalStatus === "VERIFIED")).toBe(
				true,
			);
			expect(mockBlobStorage.getObjectMetadata).toHaveBeenCalledTimes(3);
		});

		// ===========================
		// Blob Not Found
		// ===========================

		it("APP-COM-VRF-005 should mark item as FAILED when blob does not exist", async () => {
			const uploadedItem = makeUploadItem({
				status: "UPLOADED",
				md5Hash: "a".repeat(32),
			});
			const session = makeUploadSession({
				status: "OPEN",
				items: [uploadedItem],
			});

			const input: CompleteSessionInput = {
				sessionId: session.id,
				verifyAndPromote: true,
				failOnIncomplete: false,
			};

			mockSessionRepo.findById.mockResolvedValue(session);
			mockSessionRepo.save.mockResolvedValue(undefined);
			mockBlobStorage.getObjectMetadata.mockResolvedValue({
				exists: false,
			});

			const result = await useCase.execute(input);

			expect(result.results[0].finalStatus).toBe("FAILED");
			expect(result.results[0].error?.message).toContain(
				"Blob not found in storage",
			);
		});

		// ===========================
		// Items in Different States
		// ===========================

		it("APP-COM-STS-ITM-001 should fail PENDING items when verification is enabled", async () => {
			const pendingItem = makeUploadItem({
				status: "PENDING",
				md5Hash: null,
			});
			const session = makeUploadSession({
				status: "OPEN",
				items: [pendingItem],
			});

			const input: CompleteSessionInput = {
				sessionId: session.id,
				verifyAndPromote: true,
				failOnIncomplete: false,
			};

			mockSessionRepo.findById.mockResolvedValue(session);
			mockSessionRepo.save.mockResolvedValue(undefined);
			mockBlobStorage.getObjectMetadata.mockResolvedValue({
				exists: false,
			});

			const result = await useCase.execute(input);

			expect(result.results[0].finalStatus).toBe("FAILED");
			expect(mockBlobStorage.getObjectMetadata).toHaveBeenCalledTimes(1);
		});

		it("APP-COM-STS-ITM-002 should fail IN_PROGRESS items when blob not found", async () => {
			const inProgressItem = makeUploadItem({
				status: "IN_PROGRESS",
				md5Hash: "a".repeat(32),
			});
			const session = makeUploadSession({
				status: "OPEN",
				items: [inProgressItem],
			});

			const input: CompleteSessionInput = {
				sessionId: session.id,
				verifyAndPromote: true,
				failOnIncomplete: false,
			};

			mockSessionRepo.findById.mockResolvedValue(session);
			mockSessionRepo.save.mockResolvedValue(undefined);
			mockBlobStorage.getObjectMetadata.mockResolvedValue({
				exists: false,
			});

			const result = await useCase.execute(input);

			expect(result.results[0].finalStatus).toBe("FAILED");
		});

		// ===========================
		// Azure Error Scenarios
		// ===========================

		it("APP-COM-AZR-THRT-001 should handle Azure 429 throttling error", async () => {
			const uploadedItem = makeUploadItem({
				status: "UPLOADED",
				md5Hash: "a".repeat(32),
			});
			const session = makeUploadSession({
				status: "OPEN",
				items: [uploadedItem],
			});

			const input: CompleteSessionInput = {
				sessionId: session.id,
				verifyAndPromote: true,
				failOnIncomplete: false,
			};

			const throttleError = new Error("TooManyRequests");
			Object.assign(throttleError, { statusCode: 429 });

			mockSessionRepo.findById.mockResolvedValue(session);
			mockSessionRepo.save.mockResolvedValue(undefined);
			mockBlobStorage.getObjectMetadata.mockRejectedValue(throttleError);

			const result = await useCase.execute(input);

			expect(result.results[0].finalStatus).toBe("FAILED");
			expect(result.results[0].error?.message).toContain("TooManyRequests");
		});

		it("APP-COM-AZR-002 should continue processing other items after one fails", async () => {
			const item1 = makeUploadItem({
				status: "UPLOADED",
				md5Hash: "a".repeat(32),
			});
			const item2 = makeUploadItem({
				status: "UPLOADED",
				md5Hash: "b".repeat(32),
			});
			const item3 = makeUploadItem({
				status: "UPLOADED",
				md5Hash: "c".repeat(32),
			});

			const session = makeUploadSession({
				status: "OPEN",
				items: [item1, item2, item3],
			});

			const input: CompleteSessionInput = {
				sessionId: session.id,
				verifyAndPromote: true,
				failOnIncomplete: false,
			};

			mockSessionRepo.findById.mockResolvedValue(session);
			mockSessionRepo.save.mockResolvedValue(undefined);
			mockBlobStorage.getObjectMetadata
				.mockResolvedValueOnce({
					exists: true,
					md5Hash: "a".repeat(32),
					sizeInBytes: 1024,
				})
				.mockRejectedValueOnce(new Error("Network timeout")) // item2 fails
				.mockResolvedValueOnce({
					exists: true,
					md5Hash: "c".repeat(32),
					sizeInBytes: 3072,
				});

			const result = await useCase.execute(input);

			expect(result.results).toHaveLength(3);
			expect(result.results[0].finalStatus).toBe("VERIFIED");
			expect(result.results[1].finalStatus).toBe("FAILED");
			expect(result.results[2].finalStatus).toBe("VERIFIED");
			expect(mockBlobStorage.getObjectMetadata).toHaveBeenCalledTimes(3);
		});

		// ===========================
		// Summary and Logging
		// ===========================

		it("APP-COM-SUM-001 should count VERIFIED as success in summary", async () => {
			const item1 = makeUploadItem({
				status: "UPLOADED",
				md5Hash: "a".repeat(32),
			});
			const item2 = makeUploadItem({
				status: "UPLOADED",
				md5Hash: "b".repeat(32),
			});

			const session = makeUploadSession({
				status: "OPEN",
				items: [item1, item2],
			});

			const input: CompleteSessionInput = {
				sessionId: session.id,
				verifyAndPromote: true,
				failOnIncomplete: false,
			};

			mockSessionRepo.findById.mockResolvedValue(session);
			mockSessionRepo.save.mockResolvedValue(undefined);
			mockBlobStorage.getObjectMetadata
				.mockResolvedValueOnce({
					exists: true,
					md5Hash: "a".repeat(32),
					sizeInBytes: 1024,
				})
				.mockResolvedValueOnce({
					exists: true,
					md5Hash: "b".repeat(32),
					sizeInBytes: 2048,
				});

			await useCase.execute(input);

			expect(mockLogger.log).toHaveBeenCalledWith(
				"Session completed",
				expect.objectContaining({
					sessionId: session.id,
					finalStatus: "COMPLETED",
					totalItems: 2,
					uploadedCount: 2, // Both VERIFIED items counted as success
					failedCount: 0,
				}),
			);
		});

		it("APP-COM-SUM-002 should log enhanced context for item verification", async () => {
			const uploadedItem = makeUploadItem({
				clientItemId: "client-123",
				status: "UPLOADED",
				md5Hash: "a".repeat(32),
			});
			const session = makeUploadSession({
				status: "OPEN",
				items: [uploadedItem],
			});

			const input: CompleteSessionInput = {
				sessionId: session.id,
				verifyAndPromote: true,
				failOnIncomplete: false,
			};

			mockSessionRepo.findById.mockResolvedValue(session);
			mockSessionRepo.save.mockResolvedValue(undefined);
			mockBlobStorage.getObjectMetadata.mockResolvedValue({
				exists: true,
				md5Hash: "a".repeat(32),
				sizeInBytes: 1024,
			});

			await useCase.execute(input);

			expect(mockLogger.debug).toHaveBeenCalledWith(
				"Item verified successfully",
				expect.objectContaining({
					itemId: uploadedItem.id,
					clientItemId: "client-123",
					blobName: uploadedItem.location.blobName,
				}),
			);
		});

		it("APP-COM-PROM-001 should promote PENDING -> UPLOADED and verify when MD5 matches", async () => {
			// Ítem arranca en PENDING con md5 local conocido
			const pendingItem = makeUploadItem({
				status: "PENDING",
				md5Hash: "a".repeat(32),
			});
			const session = makeUploadSession({
				status: "OPEN",
				items: [pendingItem],
			});

			const input: CompleteSessionInput = {
				sessionId: session.id,
				verifyAndPromote: true,
				failOnIncomplete: false,
			};

			mockSessionRepo.findById.mockResolvedValue(session);
			mockSessionRepo.save.mockResolvedValue(undefined);
			mockBlobStorage.getObjectMetadata.mockResolvedValue({
				exists: true,
				md5Hash: "a".repeat(32),
				sizeInBytes: 30320,
			});

			const result = await useCase.execute(input);

			// Debe haberse promovido internamente a UPLOADED y luego VERIFIED
			expect(result.finalStatus).toBe("COMPLETED");
			expect(result.results).toHaveLength(1);
			expect(result.results[0].finalStatus).toBe("VERIFIED");
			expect(mockBlobStorage.getObjectMetadata).toHaveBeenCalledTimes(1);
		});

		it("APP-COM-PROM-002 should promote IN_PROGRESS -> UPLOADED and verify when MD5 matches", async () => {
			// Ítem arranca en IN_PROGRESS y debe pasar por UPLOADED antes de VERIFIED
			const inProgressItem = makeUploadItem({
				status: "IN_PROGRESS",
				md5Hash: "b".repeat(32),
			});
			const session = makeUploadSession({
				status: "OPEN",
				items: [inProgressItem],
			});

			const input: CompleteSessionInput = {
				sessionId: session.id,
				verifyAndPromote: true,
				failOnIncomplete: false,
			};

			mockSessionRepo.findById.mockResolvedValue(session);
			mockSessionRepo.save.mockResolvedValue(undefined);
			mockBlobStorage.getObjectMetadata.mockResolvedValue({
				exists: true,
				md5Hash: "b".repeat(32),
				sizeInBytes: 1111,
			});

			const result = await useCase.execute(input);

			// Debe terminar VERIFIED
			expect(result.finalStatus).toBe("COMPLETED");
			expect(result.results).toHaveLength(1);
			expect(result.results[0].finalStatus).toBe("VERIFIED");
			expect(mockBlobStorage.getObjectMetadata).toHaveBeenCalledTimes(1);
		});

		it("APP-COM-NV-002 should NOT promote when verifyAndPromote=false and item is PENDING (session stays OPEN)", async () => {
			// Sin verificación/promoción: el ítem permanece PENDING y la sesión queda OPEN
			const pendingItem = makeUploadItem({
				status: "PENDING",
				md5Hash: "c".repeat(32),
			});
			const session = makeUploadSession({
				status: "OPEN",
				items: [pendingItem],
			});

			const input: CompleteSessionInput = {
				sessionId: session.id,
				verifyAndPromote: false,
				failOnIncomplete: false,
			};

			mockSessionRepo.findById.mockResolvedValue(session);
			mockSessionRepo.save.mockResolvedValue(undefined);

			const result = await useCase.execute(input);

			// La sesión permanece OPEN (no se completa ni falla)
			expect(result.finalStatus).toBe("OPEN");
			expect(result.results).toHaveLength(1);
			// El ítem no debe estar VERIFIED; típicamente seguirá en PENDING
			expect(result.results[0].finalStatus).not.toBe("VERIFIED");
			expect(mockBlobStorage.getObjectMetadata).not.toHaveBeenCalled();
			expect(mockSessionRepo.save).toHaveBeenCalledTimes(1);
		});
	});
});
