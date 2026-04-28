import { Test, type TestingModule } from "@nestjs/testing";
import { RefreshSasBatchUseCase } from "./refresh-sas-batch.use-case";
import {
	RefreshSasBatchMapper,
	REFRESH_SAS_BATCH_MAPPER,
} from "../mappers/refresh-sas-batch.mapper";
import { LOGGER } from "../ports/logger.port";
import { UPLOAD_SESSIONS_REPOSITORY } from "../ports/repositories/upload-sessions.repo.port";
import { BLOB_STORAGE } from "../ports/blob-storage.port";
import {
	MockLogger,
	MockUploadSessionsRepository,
	MockBlobStorage,
} from "../../test/mocks";
import {
	makeUploadSession,
	makeUploadItem,
	randomUUID,
} from "../../test/factories";
import { RefreshSasBatchInput } from "../dto/refresh-sas-batch/refresh-sas-batch.input";
import { SessionNotFoundError } from "../errors/session-not-found.error";
import { ItemNotFoundError } from "../errors/item-not-found.error";
import { SessionNotOpenError } from "../../domain/errors/session-not-open.error";

describe("RefreshSasBatchUseCase", () => {
	let useCase: RefreshSasBatchUseCase;
	let mockLogger: MockLogger;
	let mockSessionRepo: MockUploadSessionsRepository;
	let mockBlobStorage: MockBlobStorage;
	// let mapper: RefreshSasBatchMapper;

	beforeEach(async () => {
		mockLogger = new MockLogger();
		mockSessionRepo = new MockUploadSessionsRepository();
		mockBlobStorage = new MockBlobStorage();

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				RefreshSasBatchUseCase,
				{ provide: REFRESH_SAS_BATCH_MAPPER, useClass: RefreshSasBatchMapper },
				{ provide: LOGGER, useValue: mockLogger },
				{ provide: UPLOAD_SESSIONS_REPOSITORY, useValue: mockSessionRepo },
				{ provide: BLOB_STORAGE, useValue: mockBlobStorage },
			],
		}).compile();

		useCase = module.get<RefreshSasBatchUseCase>(RefreshSasBatchUseCase);
		// mapper = module.get<RefreshSasBatchMapper>(REFRESH_SAS_BATCH_MAPPER);
	});

	describe("execute", () => {
		const blobName = "plant/2025-01-01/item-1/test.jpg";
		const sessionId = randomUUID(); // Use valid UUID v4

		const validInput: RefreshSasBatchInput = {
			sessionId,
			items: [
				{
					objectKey: blobName,
					contentType: "image/jpeg",
				},
			],
		};

		it("should refresh SAS tokens successfully for an OPEN session", async () => {
			// APP-SAS-REF-001 - Refresh SAS válido (sesión OPEN)
			const item = makeUploadItem({
				id: "item-1",
				blobName,
				status: "IN_PROGRESS",
			});

			const session = makeUploadSession({
				id: sessionId,
				status: "OPEN",
				domain: "field",
				items: [item],
			});

			const mockSignedUrls = [
				{
					objectKey: blobName,
					url: "https://storage.azure.com/container/blob?sas=refreshed-token",
					objectUrl: "https://storage.azure.com/container/blob",
					expiresOn: new Date("2025-01-01T03:00:00Z"),
				},
			];

			mockSessionRepo.findById.mockResolvedValue(session);
			mockBlobStorage.generateUploadUrls.mockResolvedValue(mockSignedUrls);

			const result = await useCase.execute(validInput);

			expect(mockSessionRepo.findById).toHaveBeenCalledWith(sessionId);
			expect(mockBlobStorage.generateUploadUrls).toHaveBeenCalledWith(
				[
					{
						domain: "field",
						objectKey: blobName,
						contentType: "image/jpeg",
					},
				],
				60, // Default TTL
			);
			expect(result).toBeDefined();
			expect(result.urls).toHaveLength(1);
			expect(result.urls[0].objectKey).toBe(blobName);
			expect(result.urls[0].signedUrl).toContain("refreshed-token");
			expect(mockLogger.log).toHaveBeenCalledWith(
				"SAS tokens refreshed successfully",
				expect.objectContaining({
					sessionId: sessionId,
					tokenCount: 1,
					ttlMinutes: 60,
				}),
			);
		});

		it("should refresh SAS for multiple items at once", async () => {
			// APP-SAS-REF-001 - Multiple items refresh
			const items = [
				makeUploadItem({
					blobName: "field/2025/item-1/file1.jpg",
					status: "IN_PROGRESS",
				}),
				makeUploadItem({
					blobName: "field/2025/item-2/file2.png",
					status: "UPLOADED",
				}),
				makeUploadItem({
					blobName: "field/2025/item-3/file3.webp",
					status: "PENDING",
				}),
			];

			const session = makeUploadSession({
				id: sessionId,
				status: "OPEN",
				domain: "field",
				items,
			});

			const multiItemInput: RefreshSasBatchInput = {
				sessionId: sessionId,
				items: [
					{
						objectKey: "field/2025/item-1/file1.jpg",
						contentType: "image/jpeg",
					},
					{
						objectKey: "field/2025/item-2/file2.png",
						contentType: "image/png",
					},
					{
						objectKey: "field/2025/item-3/file3.webp",
						contentType: "image/webp",
					},
				],
			};

			mockSessionRepo.findById.mockResolvedValue(session);
			mockBlobStorage.generateUploadUrls.mockResolvedValue(
				multiItemInput.items.map((item) => ({
					objectKey: item.objectKey,
					url: `https://storage.azure.com/${item.objectKey}?refreshed`,
					objectUrl: `https://storage.azure.com/${item.objectKey}`,
					expiresOn: new Date(),
				})),
			);

			const result = await useCase.execute(multiItemInput);

			expect(result.urls).toHaveLength(3);
			expect(mockBlobStorage.generateUploadUrls).toHaveBeenCalledWith(
				[
					{
						domain: "field",
						objectKey: "field/2025/item-1/file1.jpg",
						contentType: "image/jpeg",
					},
					{
						domain: "field",
						objectKey: "field/2025/item-2/file2.png",
						contentType: "image/png",
					},
					{
						domain: "field",
						objectKey: "field/2025/item-3/file3.webp",
						contentType: "image/webp",
					},
				],
				60,
			);
		});

		it("should throw SessionNotFoundError when session does not exist", async () => {
			// APP-SAS-REF-002 - Session not found
			mockSessionRepo.findById.mockResolvedValue(null);

			await expect(useCase.execute(validInput)).rejects.toThrow(
				SessionNotFoundError,
			);

			expect(mockSessionRepo.findById).toHaveBeenCalledWith(sessionId);
			expect(mockLogger.warn).toHaveBeenCalledWith(
				"Session not found for SAS refresh",
				expect.objectContaining({
					sessionId: sessionId,
					operation: "refresh-sas-batch",
				}),
			);
			expect(mockBlobStorage.generateUploadUrls).not.toHaveBeenCalled();
		});

		it("should throw SessionNotOpenError when session is COMPLETED", async () => {
			// APP-SAS-REF-003 - Sesión no OPEN (COMPLETED)

			const completedSession = makeUploadSession({
				id: sessionId,
				status: "COMPLETED",
				items: [
					makeUploadItem({
						blobName: "plant/2025/item-1/file1.jpg",
						status: "VERIFIED",
					}),
				],
			});

			mockSessionRepo.findById.mockResolvedValue(completedSession);

			await expect(useCase.execute(validInput)).rejects.toThrow(
				SessionNotOpenError,
			);

			expect(mockSessionRepo.findById).toHaveBeenCalledWith(sessionId);
			expect(mockBlobStorage.generateUploadUrls).not.toHaveBeenCalled();
		});

		it("should throw SessionNotOpenError when session is FAILED", async () => {
			// APP-SAS-REF-003 - Sesión no OPEN (FAILED)
			const failedSession = makeUploadSession({
				id: sessionId,
				status: "FAILED",
			});

			mockSessionRepo.findById.mockResolvedValue(failedSession);

			await expect(useCase.execute(validInput)).rejects.toThrow(
				SessionNotOpenError,
			);

			expect(mockSessionRepo.findById).toHaveBeenCalledWith(sessionId);
			expect(mockBlobStorage.generateUploadUrls).not.toHaveBeenCalled();
		});

		it("should throw ItemNotFoundError when item does not exist in session", async () => {
			// APP-SAS-REF-004 - Item no existe → ItemNotFoundError
			const session = makeUploadSession({
				id: sessionId,
				status: "OPEN",
				items: [makeUploadItem({ blobName: "plant/2025/item-1/file1.jpg" })],
			});

			const inputWithInvalidItem: RefreshSasBatchInput = {
				sessionId: sessionId,
				items: [
					{
						objectKey: "plant/2025/non-existent-item/file.jpg",
						contentType: "image/jpeg",
					},
				],
			};

			mockSessionRepo.findById.mockResolvedValue(session);

			await expect(useCase.execute(inputWithInvalidItem)).rejects.toThrow(
				ItemNotFoundError,
			);

			expect(mockBlobStorage.generateUploadUrls).not.toHaveBeenCalled();
		});

		it("should throw ItemNotFoundError when one of multiple items does not exist", async () => {
			// APP-SAS-REF-004 - Partial item not found
			const session = makeUploadSession({
				id: sessionId,
				status: "OPEN",
				items: [
					makeUploadItem({ blobName: "plant/2025/item-1/file1.jpg" }),
					makeUploadItem({ blobName: "plant/2025/item-2/file2.jpg" }),
				],
			});

			const inputWithMixedItems: RefreshSasBatchInput = {
				sessionId: sessionId,
				items: [
					{
						objectKey: "plant/2025/item-1/file1.jpg",
						contentType: "image/jpeg",
					},
					{
						objectKey: "plant/2025/invalid-item/file.jpg",
						contentType: "image/png",
					},
				],
			};

			mockSessionRepo.findById.mockResolvedValue(session);

			await expect(useCase.execute(inputWithMixedItems)).rejects.toThrow(
				ItemNotFoundError,
			);

			expect(mockBlobStorage.generateUploadUrls).not.toHaveBeenCalled();
		});

		it("should propagate Azure storage errors", async () => {
			// APP-SAS-REF-005 - Azure falla → error propagado
			const item = makeUploadItem({ blobName, status: "PENDING" });
			const session = makeUploadSession({
				id: sessionId,
				status: "OPEN",
				items: [item],
			});

			const azureError = new Error("Azure service unavailable");

			mockSessionRepo.findById.mockResolvedValue(session);
			mockBlobStorage.generateUploadUrls.mockRejectedValue(azureError);

			await expect(useCase.execute(validInput)).rejects.toThrow(
				"Azure service unavailable",
			);

			expect(mockBlobStorage.generateUploadUrls).toHaveBeenCalled();
		});

		it("should handle network timeout errors from Azure", async () => {
			// APP-SAS-REF-005 - Network timeout
			const item = makeUploadItem({ blobName, status: "IN_PROGRESS" });
			const session = makeUploadSession({
				id: sessionId,
				status: "OPEN",
				items: [item],
			});

			const timeoutError = new Error("ECONNREFUSED");

			mockSessionRepo.findById.mockResolvedValue(session);
			mockBlobStorage.generateUploadUrls.mockRejectedValue(timeoutError);

			await expect(useCase.execute(validInput)).rejects.toThrow("ECONNREFUSED");
		});

		it("should handle Azure authentication errors", async () => {
			// APP-SAS-REF-005 - Auth error
			const item = makeUploadItem({ blobName, status: "PENDING" });
			const session = makeUploadSession({
				id: sessionId,
				status: "OPEN",
				items: [item],
			});

			const authError = new Error("Authentication failed");

			mockSessionRepo.findById.mockResolvedValue(session);
			mockBlobStorage.generateUploadUrls.mockRejectedValue(authError);

			await expect(useCase.execute(validInput)).rejects.toThrow(
				"Authentication failed",
			);
		});

		it("should use findItemByBlobName method correctly", async () => {
			// Verify internal logic uses session.findItemByBlobName
			const item = makeUploadItem({
				id: "item-1",
				blobName,
				status: "UPLOADED",
			});

			const session = makeUploadSession({
				id: sessionId,
				status: "OPEN",
				items: [item],
			});

			const findItemSpy = jest.spyOn(session, "findItemByBlobName");

			mockSessionRepo.findById.mockResolvedValue(session);
			mockBlobStorage.generateUploadUrls.mockResolvedValue([
				{
					objectKey: blobName,
					url: "https://storage.azure.com/blob",
					objectUrl: "https://storage.azure.com/blob",
					expiresOn: new Date(),
				},
			]);

			await useCase.execute(validInput);

			expect(findItemSpy).toHaveBeenCalledWith(blobName);
		});

		it("should log debug information before refreshing SAS", async () => {
			// Logging verification
			const item = makeUploadItem({ blobName, status: "PENDING" });
			const session = makeUploadSession({
				id: sessionId,
				status: "OPEN",
				items: [item],
			});

			mockSessionRepo.findById.mockResolvedValue(session);
			mockBlobStorage.generateUploadUrls.mockResolvedValue([
				{
					objectKey: blobName,
					url: "https://storage.azure.com/blob",
					objectUrl: "https://storage.azure.com/blob",
					expiresOn: new Date(),
				},
			]);

			await useCase.execute(validInput);

			expect(mockLogger.debug).toHaveBeenCalledWith("Refreshing SAS batch", {
				sessionId: sessionId,
				itemCount: 1,
			});
		});

		it("should always use default TTL (does not accept custom TTL)", async () => {
			// RefreshSasBatch always uses DEFAULT_TTL_MINUTES (different from GetSasBatch)
			const item = makeUploadItem({ blobName, status: "PENDING" });
			const session = makeUploadSession({
				id: sessionId,
				status: "OPEN",
				items: [item],
			});

			mockSessionRepo.findById.mockResolvedValue(session);
			mockBlobStorage.generateUploadUrls.mockResolvedValue([
				{
					objectKey: blobName,
					url: "https://storage.azure.com/blob",
					objectUrl: "https://storage.azure.com/blob",
					expiresOn: new Date(),
				},
			]);

			await useCase.execute(validInput);

			expect(mockBlobStorage.generateUploadUrls).toHaveBeenCalledWith(
				expect.anything(),
				60, // Always DEFAULT_TTL_MINUTES
			);
		});

		// ===========================
		// Input Validation
		// ===========================

		it("SAS-REF-VAL-UUID-001 should reject invalid sessionId format", async () => {
			const invalidInput: RefreshSasBatchInput = {
				sessionId: "not-a-uuid",
				items: [{ objectKey: blobName, contentType: "image/jpeg" }],
			};

			await expect(useCase.execute(invalidInput)).rejects.toThrow(
				"Invalid session ID format",
			);

			expect(mockSessionRepo.findById).not.toHaveBeenCalled();
		});

		it("SAS-REF-EMPTY-001 should return empty array for empty items without calling storage", async () => {
			const session = makeUploadSession({
				id: sessionId,
				status: "OPEN",
				items: [],
			});

			mockSessionRepo.findById.mockResolvedValue(session);

			const emptyInput: RefreshSasBatchInput = {
				sessionId,
				items: [],
			};

			const result = await useCase.execute(emptyInput);

			expect(result.urls).toHaveLength(0);
			expect(mockBlobStorage.generateUploadUrls).not.toHaveBeenCalled();
			expect(mockLogger.debug).toHaveBeenCalledWith(
				"No items to refresh SAS tokens for",
				expect.objectContaining({ sessionId }),
			);
		});

		// ===========================
		// Batch Size Limits
		// ===========================

		it("SAS-REF-LIMIT-001 should reject batch size exceeding maximum", async () => {
			const session = makeUploadSession({
				id: sessionId,
				status: "OPEN",
				items: [],
			});

			mockSessionRepo.findById.mockResolvedValue(session);

			const bigBatch = Array.from({ length: 501 }, (_, i) => ({
				objectKey: `field/2025/item-${i}/file.jpg`,
				contentType: "image/jpeg",
			}));

			const bigInput: RefreshSasBatchInput = {
				sessionId,
				items: bigBatch,
			};

			await expect(useCase.execute(bigInput)).rejects.toThrow(
				"Too many items in batch",
			);

			expect(mockBlobStorage.generateUploadUrls).not.toHaveBeenCalled();
			expect(mockLogger.warn).toHaveBeenCalledWith(
				"Refresh SAS batch size exceeds maximum",
				expect.objectContaining({
					sessionId,
					requestedCount: 501,
					maxAllowed: 500,
				}),
			);
		});

		// ===========================
		// Deduplication
		// ===========================

		it("SAS-REF-DEDUP-001 should deduplicate items with same objectKey", async () => {
			const item = makeUploadItem({ blobName, status: "PENDING" });
			const session = makeUploadSession({
				id: sessionId,
				status: "OPEN",
				items: [item],
			});

			mockSessionRepo.findById.mockResolvedValue(session);
			mockBlobStorage.generateUploadUrls.mockResolvedValue([
				{
					objectKey: blobName,
					url: "https://storage.azure.com/blob",
					objectUrl: "https://storage.azure.com/blob",
					expiresOn: new Date(),
				},
			]);

			const inputWithDuplicates: RefreshSasBatchInput = {
				sessionId,
				items: [
					{ objectKey: blobName, contentType: "image/jpeg" },
					{ objectKey: blobName, contentType: "image/jpeg" },
					{ objectKey: blobName, contentType: "image/jpeg" },
				],
			};

			await useCase.execute(inputWithDuplicates);

			const [requests] = mockBlobStorage.generateUploadUrls.mock.calls[0];
			expect(requests).toHaveLength(1); // Deduplicated to 1

			expect(mockLogger.debug).toHaveBeenCalledWith(
				"Deduplicated items in refresh SAS batch request",
				expect.objectContaining({
					originalCount: 3,
					uniqueCount: 1,
				}),
			);
		});

		it("SAS-REF-DEDUP-002 should handle mix of unique and duplicate items", async () => {
			const blobName1 = "field/2025-01-01/item-1/file1.jpg";
			const blobName2 = "field/2025-01-01/item-2/file2.jpg";

			const item1 = makeUploadItem({
				blobName: blobName1,
				status: "PENDING",
			});
			const item2 = makeUploadItem({
				blobName: blobName2,
				status: "PENDING",
			});

			const session = makeUploadSession({
				id: sessionId,
				status: "OPEN",
				items: [item1, item2],
			});

			mockSessionRepo.findById.mockResolvedValue(session);
			mockBlobStorage.generateUploadUrls.mockResolvedValue([
				{
					objectKey: blobName1,
					url: "https://storage.azure.com/blob1",
					objectUrl: "https://storage.azure.com/blob1",
					expiresOn: new Date(),
				},
				{
					objectKey: blobName2,
					url: "https://storage.azure.com/blob2",
					objectUrl: "https://storage.azure.com/blob2",
					expiresOn: new Date(),
				},
			]);

			const inputWithMixedDuplicates: RefreshSasBatchInput = {
				sessionId,
				items: [
					{ objectKey: blobName1, contentType: "image/jpeg" },
					{ objectKey: blobName2, contentType: "image/png" },
					{ objectKey: blobName1, contentType: "image/jpeg" }, // Duplicate
				],
			};

			await useCase.execute(inputWithMixedDuplicates);

			const [requests] = mockBlobStorage.generateUploadUrls.mock.calls[0];
			expect(requests).toHaveLength(2); // 2 unique items

			expect(mockLogger.debug).toHaveBeenCalledWith(
				"Deduplicated items in refresh SAS batch request",
				expect.objectContaining({
					originalCount: 3,
					uniqueCount: 2,
				}),
			);
		});

		// ===========================
		// Azure Error Scenarios
		// ===========================

		it("SAS-REF-AZR-THROTTLE-001 should propagate Azure 429 throttling error", async () => {
			const item = makeUploadItem({ blobName, status: "IN_PROGRESS" });
			const session = makeUploadSession({
				id: sessionId,
				status: "OPEN",
				items: [item],
			});

			const throttleError = new Error("TooManyRequests");
			Object.assign(throttleError, { statusCode: 429 });

			mockSessionRepo.findById.mockResolvedValue(session);
			mockBlobStorage.generateUploadUrls.mockRejectedValue(throttleError);

			await expect(useCase.execute(validInput)).rejects.toThrow(
				"TooManyRequests",
			);

			expect(mockBlobStorage.generateUploadUrls).toHaveBeenCalled();
		});

		// ===========================
		// No Storage Call When All Items Fail
		// ===========================

		it("SAS-REF-FAIL-ALL-001 should not call storage when all items are not found", async () => {
			const session = makeUploadSession({
				id: sessionId,
				status: "OPEN",
				items: [makeUploadItem({ blobName: "field/2025/existing.jpg" })],
			});

			mockSessionRepo.findById.mockResolvedValue(session);

			const inputWithNonExistentItems: RefreshSasBatchInput = {
				sessionId,
				items: [
					{
						objectKey: "field/2025/non-existent.jpg",
						contentType: "image/jpeg",
					},
				],
			};

			await expect(useCase.execute(inputWithNonExistentItems)).rejects.toThrow(
				ItemNotFoundError,
			);

			expect(mockBlobStorage.generateUploadUrls).not.toHaveBeenCalled();
		});
	});
});
