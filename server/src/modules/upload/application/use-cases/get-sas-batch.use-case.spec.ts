import { Test, type TestingModule } from "@nestjs/testing";
import { GetSasBatchUseCase } from "./get-sas-batch.use-case";
import {
	GetSasBatchMapper,
	GET_SAS_BATCH_MAPPER,
} from "../mappers/get-sas-batch.mapper";
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
import { GetSasBatchInput } from "../dto/get-sas-batch/get-sas-batch.input";
import { SessionNotFoundError } from "../errors/session-not-found.error";
import { ItemNotFoundError } from "../errors/item-not-found.error";
import { SessionNotOpenError } from "../../domain/errors/session-not-open.error";

describe("GetSasBatchUseCase", () => {
	let useCase: GetSasBatchUseCase;
	let mockLogger: MockLogger;
	let mockSessionRepo: MockUploadSessionsRepository;
	let mockBlobStorage: MockBlobStorage;
	// let mapper: GetSasBatchMapper;

	beforeEach(async () => {
		mockLogger = new MockLogger();
		mockSessionRepo = new MockUploadSessionsRepository();
		mockBlobStorage = new MockBlobStorage();

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				GetSasBatchUseCase,
				{ provide: GET_SAS_BATCH_MAPPER, useClass: GetSasBatchMapper },
				{ provide: LOGGER, useValue: mockLogger },
				{ provide: UPLOAD_SESSIONS_REPOSITORY, useValue: mockSessionRepo },
				{ provide: BLOB_STORAGE, useValue: mockBlobStorage },
			],
		}).compile();

		useCase = module.get<GetSasBatchUseCase>(GetSasBatchUseCase);
		// mapper = module.get<GetSasBatchMapper>(GET_SAS_BATCH_MAPPER);
	});

	describe("execute", () => {
		const blobName = "plant/2025-01-01/item-1/test.jpg";

		const validInput: GetSasBatchInput = {
			sessionId: randomUUID(),
			items: [
				{
					objectKey: blobName,
					contentType: "image/jpeg",
				},
			],
			ttlMinutes: 60,
		};

		it("should generate SAS tokens successfully for an OPEN session", async () => {
			// APP-SAS-HPY-001 - Genera SAS válido (sesión OPEN)
			const item = makeUploadItem({
				id: "item-1",
				blobName,
				status: "PENDING",
			});

			const session = makeUploadSession({
				id: randomUUID(),
				status: "OPEN",
				domain: "plant",
				items: [item],
			});

			const mockSignedUrls = [
				{
					objectKey: blobName,
					url: "https://storage.azure.com/container/blob?sas=token",
					objectUrl: "https://storage.azure.com/container/blob",
					expiresOn: new Date("2025-01-01T02:00:00Z"),
				},
			];

			mockSessionRepo.findById.mockResolvedValue(session);
			mockBlobStorage.generateUploadUrls.mockResolvedValue(mockSignedUrls);

			const result = await useCase.execute(validInput);

			expect(mockSessionRepo.findById).toHaveBeenCalledWith(
				validInput.sessionId,
			);
			expect(mockBlobStorage.generateUploadUrls).toHaveBeenCalledWith(
				[
					{
						domain: "plant",
						objectKey: blobName,
						contentType: "image/jpeg",
					},
				],
				60,
			);
			expect(result).toBeDefined();
			expect(result.urls).toHaveLength(1);
			expect(result.urls[0].objectKey).toBe(blobName);
			expect(result.urls[0].signedUrl).toContain("sas=token");
			expect(mockLogger.log).toHaveBeenCalledWith(
				"SAS tokens generated successfully",
				expect.objectContaining({
					sessionId: validInput.sessionId,
					tokenCount: 1,
					ttlMinutes: 60,
				}),
			);
		});

		it("should use default TTL when ttlMinutes is not provided", async () => {
			// APP-SAS-HPY-001 - Default TTL
			const item = makeUploadItem({ blobName, status: "PENDING" });
			const session = makeUploadSession({
				id: randomUUID(),
				status: "OPEN",
				items: [item],
			});

			const inputWithoutTTL: GetSasBatchInput = {
				sessionId: randomUUID(),
				items: [{ objectKey: blobName, contentType: "image/jpeg" }],
			};

			mockSessionRepo.findById.mockResolvedValue(session);
			mockBlobStorage.generateUploadUrls.mockResolvedValue([
				{
					objectKey: blobName,
					url: "https://storage.azure.com/blob",
					objectUrl: "https://storage.azure.com/blob",
					expiresOn: new Date(),
				},
			]);

			await useCase.execute(inputWithoutTTL);

			expect(mockBlobStorage.generateUploadUrls).toHaveBeenCalledWith(
				expect.anything(),
				60, // DEFAULT_TTL_MINUTES
			);
		});

		it("should generate SAS for multiple items", async () => {
			// APP-SAS-HPY-001 - Multiple items
			const items = [
				makeUploadItem({
					blobName: "plant/2025/item-1/file1.jpg",
					status: "PENDING",
				}),
				makeUploadItem({
					blobName: "plant/2025/item-2/file2.jpg",
					status: "PENDING",
				}),
				makeUploadItem({
					blobName: "plant/2025/item-3/file3.jpg",
					status: "IN_PROGRESS",
				}),
			];

			const session = makeUploadSession({
				id: randomUUID(),
				status: "OPEN",
				items,
			});

			const multiItemInput: GetSasBatchInput = {
				sessionId: randomUUID(),
				items: [
					{
						objectKey: "plant/2025/item-1/file1.jpg",
						contentType: "image/jpeg",
					},
					{
						objectKey: "plant/2025/item-2/file2.jpg",
						contentType: "image/png",
					},
					{
						objectKey: "plant/2025/item-3/file3.jpg",
						contentType: "image/webp",
					},
				],
			};

			mockSessionRepo.findById.mockResolvedValue(session);
			mockBlobStorage.generateUploadUrls.mockResolvedValue(
				multiItemInput.items.map((item) => ({
					objectKey: item.objectKey,
					url: `https://storage.azure.com/${item.objectKey}`,
					objectUrl: `https://storage.azure.com/${item.objectKey}`,
					expiresOn: new Date(),
				})),
			);

			const result = await useCase.execute(multiItemInput);

			expect(result.urls).toHaveLength(3);
			expect(mockBlobStorage.generateUploadUrls).toHaveBeenCalledWith(
				[
					{
						domain: "plant",
						objectKey: "plant/2025/item-1/file1.jpg",
						contentType: "image/jpeg",
					},
					{
						domain: "plant",
						objectKey: "plant/2025/item-2/file2.jpg",
						contentType: "image/png",
					},
					{
						domain: "plant",
						objectKey: "plant/2025/item-3/file3.jpg",
						contentType: "image/webp",
					},
				],
				60,
			);
		});

		it("should throw SessionNotFoundError when session does not exist", async () => {
			// APP-SAS-404-001 - Session not found
			mockSessionRepo.findById.mockResolvedValue(null);

			await expect(useCase.execute(validInput)).rejects.toThrow(
				SessionNotFoundError,
			);

			expect(mockSessionRepo.findById).toHaveBeenCalledWith(
				validInput.sessionId,
			);
			expect(mockLogger.warn).toHaveBeenCalledWith(
				"Session not found for SAS generation",
				expect.objectContaining({
					sessionId: validInput.sessionId,
					operation: "get-sas-batch",
				}),
			);
			expect(mockBlobStorage.generateUploadUrls).not.toHaveBeenCalled();
		});

		it("should throw SessionNotOpenError when session is not OPEN", async () => {
			// APP-SAS-OPEN-001 - Sesión no OPEN → SessionNotOpenError
			const completedSession = makeUploadSession({
				id: randomUUID(),
				status: "COMPLETED",
			});

			mockSessionRepo.findById.mockResolvedValue(completedSession);

			await expect(useCase.execute(validInput)).rejects.toThrow(
				SessionNotOpenError,
			);

			expect(mockSessionRepo.findById).toHaveBeenCalledWith(
				validInput.sessionId,
			);
			expect(mockBlobStorage.generateUploadUrls).not.toHaveBeenCalled();
		});

		it("should throw SessionNotOpenError when session is FAILED", async () => {
			// APP-SAS-OPEN-001 - Sesión FAILED
			const failedSession = makeUploadSession({
				id: randomUUID(),
				status: "FAILED",
			});

			mockSessionRepo.findById.mockResolvedValue(failedSession);

			await expect(useCase.execute(validInput)).rejects.toThrow(
				SessionNotOpenError,
			);
		});

		it("should throw ItemNotFoundError when item does not exist in session", async () => {
			// APP-SAS-ITM-404-001 - Item no existe → ItemNotFoundError
			const session = makeUploadSession({
				id: randomUUID(),
				status: "OPEN",
				items: [makeUploadItem({ blobName: "plant/2025/item-1/file1.jpg" })],
			});

			const inputWithInvalidItem: GetSasBatchInput = {
				sessionId: randomUUID(),
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
			// APP-SAS-ITM-404-001 - Partial item not found
			const session = makeUploadSession({
				id: randomUUID(),
				status: "OPEN",
				items: [
					makeUploadItem({ blobName: "plant/2025/item-1/file1.jpg" }),
					makeUploadItem({ blobName: "plant/2025/item-2/file2.jpg" }),
				],
			});

			const inputWithMixedItems: GetSasBatchInput = {
				sessionId: randomUUID(),
				items: [
					{
						objectKey: "plant/2025/item-1/file1.jpg",
						contentType: "image/jpeg",
					},
					{
						objectKey: "plant/2025/non-existent/file.jpg",
						contentType: "image/png",
					},
				],
			};

			mockSessionRepo.findById.mockResolvedValue(session);

			await expect(useCase.execute(inputWithMixedItems)).rejects.toThrow(
				ItemNotFoundError,
			);
		});

		it("should propagate Azure storage errors", async () => {
			// APP-SAS-AZR-001 - Azure falla → error traducido/propagado
			const item = makeUploadItem({ blobName, status: "PENDING" });
			const session = makeUploadSession({
				id: randomUUID(),
				status: "OPEN",
				items: [item],
			});

			const azureError = new Error("Azure Blob Storage connection failed");

			mockSessionRepo.findById.mockResolvedValue(session);
			mockBlobStorage.generateUploadUrls.mockRejectedValue(azureError);

			await expect(useCase.execute(validInput)).rejects.toThrow(
				"Azure Blob Storage connection failed",
			);

			expect(mockBlobStorage.generateUploadUrls).toHaveBeenCalled();
		});

		it("should handle network timeout errors from Azure", async () => {
			// APP-SAS-AZR-001 - Network timeout
			const item = makeUploadItem({ blobName, status: "PENDING" });
			const session = makeUploadSession({
				id: randomUUID(),
				status: "OPEN",
				items: [item],
			});

			const timeoutError = new Error("ETIMEDOUT");

			mockSessionRepo.findById.mockResolvedValue(session);
			mockBlobStorage.generateUploadUrls.mockRejectedValue(timeoutError);

			await expect(useCase.execute(validInput)).rejects.toThrow("ETIMEDOUT");
		});

		it("should log debug information before generating SAS", async () => {
			// Logging verification
			const item = makeUploadItem({ blobName, status: "PENDING" });
			const session = makeUploadSession({
				id: randomUUID(),
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

			expect(mockLogger.debug).toHaveBeenCalledWith("Generating SAS batch", {
				sessionId: validInput.sessionId,
				itemCount: 1,
				ttlMinutes: 60,
			});
		});

		// ===========================
		// Input Validation
		// ===========================

		it("APP-SAS-VAL-UUID-001 should reject invalid sessionId format", async () => {
			const invalidInput: GetSasBatchInput = {
				sessionId: "not-a-uuid",
				items: [{ objectKey: blobName, contentType: "image/jpeg" }],
				ttlMinutes: 5,
			};

			await expect(useCase.execute(invalidInput)).rejects.toThrow(
				"Invalid session ID format",
			);

			expect(mockSessionRepo.findById).not.toHaveBeenCalled();
		});

		it("APP-SAS-VAL-EMPTY-001 should return empty array for empty items without calling storage", async () => {
			const session = makeUploadSession({
				id: validInput.sessionId,
				status: "OPEN",
				items: [],
			});

			mockSessionRepo.findById.mockResolvedValue(session);

			const emptyInput: GetSasBatchInput = {
				sessionId: validInput.sessionId,
				items: [],
			};

			const result = await useCase.execute(emptyInput);

			expect(result.urls).toHaveLength(0);
			expect(mockBlobStorage.generateUploadUrls).not.toHaveBeenCalled();
			expect(mockLogger.debug).toHaveBeenCalledWith(
				"No items to generate SAS tokens for",
				expect.objectContaining({ sessionId: validInput.sessionId }),
			);
		});

		// ===========================
		// Batch Size Limits
		// ===========================

		it("APP-SAS-LIMIT-001 should reject batch size exceeding maximum", async () => {
			const session = makeUploadSession({
				id: validInput.sessionId,
				status: "OPEN",
				items: [],
			});

			mockSessionRepo.findById.mockResolvedValue(session);

			const bigBatch = Array.from({ length: 501 }, (_, i) => ({
				objectKey: `plant/2025/item-${i}/file.jpg`,
				contentType: "image/jpeg",
			}));

			const bigInput: GetSasBatchInput = {
				sessionId: validInput.sessionId,
				items: bigBatch,
			};

			await expect(useCase.execute(bigInput)).rejects.toThrow(
				"Too many items in batch",
			);

			expect(mockBlobStorage.generateUploadUrls).not.toHaveBeenCalled();
		});

		// ===========================
		// TTL Normalization (Clamping)
		// ===========================

		it("APP-SAS-TTL-001 should clamp TTL to minimum when below range", async () => {
			const item = makeUploadItem({ blobName, status: "PENDING" });
			const session = makeUploadSession({
				id: validInput.sessionId,
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

			const inputWithLowTTL: GetSasBatchInput = {
				sessionId: validInput.sessionId,
				items: [{ objectKey: blobName, contentType: "image/jpeg" }],
				ttlMinutes: 0,
			};

			await useCase.execute(inputWithLowTTL);

			expect(mockBlobStorage.generateUploadUrls).toHaveBeenCalledWith(
				expect.any(Array),
				1, // MIN_TTL_MINUTES
			);

			expect(mockLogger.debug).toHaveBeenCalledWith(
				"TTL clamped to valid range",
				expect.objectContaining({
					requested: 0,
					actual: 1,
				}),
			);
		});

		it("APP-SAS-TTL-002 should clamp TTL to maximum when above range", async () => {
			const item = makeUploadItem({ blobName, status: "PENDING" });
			const session = makeUploadSession({
				id: validInput.sessionId,
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

			const inputWithHighTTL: GetSasBatchInput = {
				sessionId: validInput.sessionId,
				items: [{ objectKey: blobName, contentType: "image/jpeg" }],
				ttlMinutes: 9999,
			};

			await useCase.execute(inputWithHighTTL);

			expect(mockBlobStorage.generateUploadUrls).toHaveBeenCalledWith(
				expect.any(Array),
				240, // MAX_TTL_MINUTES
			);

			expect(mockLogger.debug).toHaveBeenCalledWith(
				"TTL clamped to valid range",
				expect.objectContaining({
					requested: 9999,
					actual: 240,
				}),
			);
		});

		it("APP-SAS-TTL-003 should use TTL within valid range without clamping", async () => {
			const item = makeUploadItem({ blobName, status: "PENDING" });
			const session = makeUploadSession({
				id: validInput.sessionId,
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

			const inputWithValidTTL: GetSasBatchInput = {
				sessionId: validInput.sessionId,
				items: [{ objectKey: blobName, contentType: "image/jpeg" }],
				ttlMinutes: 120,
			};

			await useCase.execute(inputWithValidTTL);

			expect(mockBlobStorage.generateUploadUrls).toHaveBeenCalledWith(
				expect.any(Array),
				120,
			);

			// Should NOT log clamping message
			expect(mockLogger.debug).not.toHaveBeenCalledWith(
				"TTL clamped to valid range",
				expect.anything(),
			);
		});

		// ===========================
		// Deduplication
		// ===========================

		it("APP-SAS-DEDUP-001 should deduplicate items with same objectKey", async () => {
			const item = makeUploadItem({ blobName, status: "PENDING" });
			const session = makeUploadSession({
				id: validInput.sessionId,
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

			const inputWithDuplicates: GetSasBatchInput = {
				sessionId: validInput.sessionId,
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
				"Deduplicated items in SAS batch request",
				expect.objectContaining({
					originalCount: 3,
					uniqueCount: 1,
				}),
			);
		});

		it("APP-SAS-DEDUP-002 should handle mix of unique and duplicate items", async () => {
			const blobName1 = "plant/2025-01-01/item-1/file1.jpg";
			const blobName2 = "plant/2025-01-01/item-2/file2.jpg";

			const item1 = makeUploadItem({ blobName: blobName1, status: "PENDING" });
			const item2 = makeUploadItem({ blobName: blobName2, status: "PENDING" });

			const session = makeUploadSession({
				id: validInput.sessionId,
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

			const inputWithMixedDuplicates: GetSasBatchInput = {
				sessionId: validInput.sessionId,
				items: [
					{ objectKey: blobName1, contentType: "image/jpeg" },
					{ objectKey: blobName2, contentType: "image/png" },
					{ objectKey: blobName1, contentType: "image/jpeg" }, // Duplicate of first
				],
			};

			await useCase.execute(inputWithMixedDuplicates);

			const [requests] = mockBlobStorage.generateUploadUrls.mock.calls[0];
			expect(requests).toHaveLength(2); // 2 unique items

			expect(mockLogger.debug).toHaveBeenCalledWith(
				"Deduplicated items in SAS batch request",
				expect.objectContaining({
					originalCount: 3,
					uniqueCount: 2,
				}),
			);
		});

		// ===========================
		// No Storage Call When All Items Fail
		// ===========================

		it("APP-SAS-FAIL-ALL-001 should not call storage when all items are not found", async () => {
			const session = makeUploadSession({
				id: validInput.sessionId,
				status: "OPEN",
				items: [makeUploadItem({ blobName: "plant/2025/existing.jpg" })],
			});

			mockSessionRepo.findById.mockResolvedValue(session);

			const inputWithNonExistentItems: GetSasBatchInput = {
				sessionId: validInput.sessionId,
				items: [
					{
						objectKey: "plant/2025/non-existent-1.jpg",
						contentType: "image/jpeg",
					},
				],
			};

			await expect(useCase.execute(inputWithNonExistentItems)).rejects.toThrow(
				ItemNotFoundError,
			);

			expect(mockBlobStorage.generateUploadUrls).not.toHaveBeenCalled();
		});

		it("APP-SAS-STATE-001 marca como IN_PROGRESS los items PENDING solicitados y persiste una sola vez", async () => {
			const blob1 = "plant/2025/i1.jpg";
			const blob2 = "plant/2025/i2.jpg";

			const i1 = makeUploadItem({ blobName: blob1, status: "PENDING" });
			const i2 = makeUploadItem({ blobName: blob2, status: "PENDING" });
			const session = makeUploadSession({
				status: "OPEN",
				items: [i1, i2],
				domain: "plant",
			});

			mockSessionRepo.findById.mockResolvedValue(session);
			mockBlobStorage.generateUploadUrls.mockResolvedValue([
				{ objectKey: blob1, url: "u1", objectUrl: "o1", expiresOn: new Date() },
			]);

			const input: GetSasBatchInput = {
				sessionId: randomUUID(),
				items: [{ objectKey: blob1, contentType: "image/jpeg" }],
				ttlMinutes: 10,
			};

			await useCase.execute(input);

			expect(i1.status).toBe("IN_PROGRESS"); // solicitado → IN_PROGRESS
			expect(i2.status).toBe("PENDING"); // NO solicitado → se queda como estaba
			expect(mockSessionRepo.save).toHaveBeenCalledTimes(1);
		});

		it("APP-SAS-STATE-002 no persiste si no había PENDING (ya estaban IN_PROGRESS/UPLOADED)", async () => {
			const blob = "plant/2025/i1.jpg";
			const i = makeUploadItem({ blobName: blob, status: "IN_PROGRESS" });
			const session = makeUploadSession({
				status: "OPEN",
				items: [i],
				domain: "plant",
			});

			mockSessionRepo.findById.mockResolvedValue(session);
			mockBlobStorage.generateUploadUrls.mockResolvedValue([
				{ objectKey: blob, url: "u", objectUrl: "o", expiresOn: new Date() },
			]);

			await useCase.execute({
				sessionId: randomUUID(),
				items: [{ objectKey: blob, contentType: "image/jpeg" }],
			});

			expect(i.status).toBe("IN_PROGRESS");
			expect(mockSessionRepo.save).not.toHaveBeenCalled(); // nada cambió
		});

		it("APP-SAS-STATE-003 dedup: ítem duplicado se marca una vez y se persiste una vez", async () => {
			const blob = "plant/2025/i1.jpg";
			const i = makeUploadItem({ blobName: blob, status: "PENDING" });
			const session = makeUploadSession({
				status: "OPEN",
				items: [i],
				domain: "plant",
			});

			mockSessionRepo.findById.mockResolvedValue(session);
			mockBlobStorage.generateUploadUrls.mockResolvedValue([
				{ objectKey: blob, url: "u", objectUrl: "o", expiresOn: new Date() },
			]);

			await useCase.execute({
				sessionId: randomUUID(),
				items: [
					{ objectKey: blob, contentType: "image/jpeg" },
					{ objectKey: blob, contentType: "image/jpeg" }, // duplicado
				],
			});

			expect(i.status).toBe("IN_PROGRESS");
			expect(mockSessionRepo.save).toHaveBeenCalledTimes(1);
			const [requests] = mockBlobStorage.generateUploadUrls.mock.calls[0];
			expect(requests).toHaveLength(1); // deduplicado
		});

		it("APP-SAS-STATE-004 no marca ni persiste si algún objectKey no existe (falla validación previa)", async () => {
			const exists = "plant/2025/existing.jpg";
			const missing = "plant/2025/missing.jpg";

			const i = makeUploadItem({ blobName: exists, status: "PENDING" });
			const session = makeUploadSession({
				status: "OPEN",
				items: [i],
				domain: "plant",
			});

			mockSessionRepo.findById.mockResolvedValue(session);

			await expect(
				useCase.execute({
					sessionId: randomUUID(),
					items: [
						{ objectKey: exists, contentType: "image/jpeg" },
						{ objectKey: missing, contentType: "image/jpeg" }, // no existe en la sesión
					],
				}),
			).rejects.toThrow(ItemNotFoundError);

			// como validamos primero, no se marcó nada ni se guardó
			expect(i.status).toBe("PENDING");
			expect(mockSessionRepo.save).not.toHaveBeenCalled();
			expect(mockBlobStorage.generateUploadUrls).not.toHaveBeenCalled();
		});

		it("APP-SAS-STATE-005 no intenta marcar cuando la sesión no está OPEN", async () => {
			const blob = "plant/2025/i1.jpg";
			const session = makeUploadSession({
				status: "COMPLETED",
				items: [],
				domain: "plant",
			});

			mockSessionRepo.findById.mockResolvedValue(session);

			await expect(
				useCase.execute({
					sessionId: randomUUID(),
					items: [{ objectKey: blob, contentType: "image/jpeg" }],
				}),
			).rejects.toThrow(SessionNotOpenError);

			expect(mockSessionRepo.save).not.toHaveBeenCalled();
			expect(mockBlobStorage.generateUploadUrls).not.toHaveBeenCalled();
		});

		it("APP-SAS-STATE-006 batch vacío: no marca ni persiste", async () => {
			const i = makeUploadItem({
				blobName: "plant/2025/i.jpg",
				status: "PENDING",
			});
			const session = makeUploadSession({
				status: "OPEN",
				items: [i],
				domain: "plant",
			});

			mockSessionRepo.findById.mockResolvedValue(session);

			const res = await useCase.execute({ sessionId: randomUUID(), items: [] });

			expect(res.urls).toHaveLength(0);
			expect(i.status).toBe("PENDING");
			expect(mockSessionRepo.save).not.toHaveBeenCalled();
			expect(mockBlobStorage.generateUploadUrls).not.toHaveBeenCalled();
		});
	});
});
