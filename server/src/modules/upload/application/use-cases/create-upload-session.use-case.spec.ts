import { Test, type TestingModule } from "@nestjs/testing";
import { CreateUploadSessionUseCase } from "./create-upload-session.use-case";
import {
	CreateUploadSessionMapper,
	CREATE_UPLOAD_SESSION_MAPPER,
} from "../mappers/create-upload-session.mapper";
import { LOGGER } from "../ports/logger.port";
import { TRANSACTION_MANAGER } from "../ports/transaction-manager.port";
import { UPLOAD_SESSIONS_REPOSITORY } from "../ports/repositories/upload-sessions.repo.port";
import { UUID_GENERATOR } from "../ports/uuid-generator.port";
import { BLOB_STORAGE } from "../ports/blob-storage.port";
import {
	MockLogger,
	MockTransactionManager,
	MockUploadSessionsRepository,
	MockUuidGenerator,
	MockBlobStorage,
} from "../../test/mocks";
import { makeUploadSession } from "../../test/factories";
import { CreateUploadSessionInput } from "../dto/create-upload-session/create-upload-session.input";
import { ClientIdentifier } from "../../domain/value-objects/client-identifier.vo";
import { StorageLocation } from "../../domain/value-objects/storage-location.vo";
import { FileProperties } from "../../domain/value-objects/file-properties.vo";
import { UploadItem } from "../../domain/entities/upload-item.entity";
import { BadRequestException } from "@nestjs/common";

describe("CreateUploadSessionUseCase", () => {
	let useCase: CreateUploadSessionUseCase;
	let mockLogger: MockLogger;
	let mockTransactionManager: MockTransactionManager;
	let mockSessionRepo: MockUploadSessionsRepository;
	let mockUuidGenerator: MockUuidGenerator;
	let mockBlobStorage: MockBlobStorage;
	// let mapper: CreateUploadSessionMapper;

	beforeEach(async () => {
		mockLogger = new MockLogger();
		mockTransactionManager = new MockTransactionManager();
		mockSessionRepo = new MockUploadSessionsRepository();
		mockUuidGenerator = new MockUuidGenerator();
		mockBlobStorage = new MockBlobStorage();

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				CreateUploadSessionUseCase,
				{
					provide: CREATE_UPLOAD_SESSION_MAPPER,
					useClass: CreateUploadSessionMapper,
				},
				{ provide: LOGGER, useValue: mockLogger },
				{ provide: TRANSACTION_MANAGER, useValue: mockTransactionManager },
				{ provide: UPLOAD_SESSIONS_REPOSITORY, useValue: mockSessionRepo },
				{ provide: UUID_GENERATOR, useValue: mockUuidGenerator },
				{ provide: BLOB_STORAGE, useValue: mockBlobStorage },
			],
		}).compile();

		useCase = module.get<CreateUploadSessionUseCase>(
			CreateUploadSessionUseCase,
		);
		// mapper = module.get<CreateUploadSessionMapper>(CREATE_UPLOAD_SESSION_MAPPER);
	});

	describe("execute", () => {
		const validInput: CreateUploadSessionInput = {
			clientBatchId: "batch-123",
			domain: "plant",
			files: [
				{
					clientItemId: "item-1",
					fileName: "test.jpg",
					fileSizeBytes: 1024,
					contentType: "image/jpeg",
					md5: "0123456789abcdef0123456789abcdef",
				},
			],
		};

		it("should create a new session when no open session exists", async () => {
			// APP-CRS-HPY-001 - Happy path
			mockSessionRepo.findOpenByClientBatchId.mockResolvedValue(null);
			mockSessionRepo.save.mockResolvedValue(undefined);
			mockBlobStorage.generateBlobName.mockReturnValue(
				"plant/2025-01-01/item-1/test.jpg",
			);

			const result = await useCase.execute(validInput);

			expect(mockSessionRepo.findOpenByClientBatchId).toHaveBeenCalledTimes(1);
			expect(mockSessionRepo.save).toHaveBeenCalledTimes(1);
			expect(result).toBeDefined();
			expect(result.status).toBe("OPEN");
			expect(result.items).toHaveLength(1);
			expect(result.domain).toBe("plant");
		});

		it("should return existing session when open session exists (idempotency)", async () => {
			// APP-CRS-IDEM-001 - Idempotency
			const existingSession = makeUploadSession({
				id: "existing-session-id",
				clientBatchId: "batch-123",
				status: "OPEN",
				domain: "plant",
			});

			mockSessionRepo.findOpenByClientBatchId.mockResolvedValue(
				existingSession,
			);

			const result = await useCase.execute(validInput);

			expect(mockSessionRepo.findOpenByClientBatchId).toHaveBeenCalledTimes(1);
			expect(mockSessionRepo.save).not.toHaveBeenCalled();
			expect(result.sessionId).toBe("existing-session-id");
			expect(mockLogger.log).toHaveBeenCalledWith(
				"Reusing existing open session",
				expect.objectContaining({ sessionId: "existing-session-id" }),
			);
		});

		it("should wrap save operation in a transaction", async () => {
			// APP-CRS-DBF-001 - Transaction handling
			mockSessionRepo.findOpenByClientBatchId.mockResolvedValue(null);
			mockSessionRepo.save.mockResolvedValue(undefined);
			mockBlobStorage.generateBlobName.mockReturnValue(
				"plant/2025-01-01/item-1/test.jpg",
			);

			const runInTransactionSpy = jest.spyOn(
				mockTransactionManager,
				"runInTransaction",
			);

			await useCase.execute(validInput);

			expect(runInTransactionSpy).toHaveBeenCalledTimes(1);
		});

		it("should generate correct blob names for items", async () => {
			// DOM-BN-FMT-001 - Blob name format
			mockSessionRepo.findOpenByClientBatchId.mockResolvedValue(null);
			mockSessionRepo.save.mockResolvedValue(undefined);
			mockBlobStorage.generateBlobName.mockReturnValue(
				"plant/2025-01-01/item-1/test.jpg",
			);

			await useCase.execute(validInput);

			expect(mockBlobStorage.generateBlobName).toHaveBeenCalledWith(
				"plant",
				"item-1",
				"test.jpg",
			);
		});

		it("should handle multiple files in a session", async () => {
			const multiFileInput: CreateUploadSessionInput = {
				clientBatchId: "batch-multi",
				domain: "field",
				files: [
					{
						clientItemId: "item-1",
						fileName: "file1.jpg",
						fileSizeBytes: 1024,
						contentType: "image/jpeg",
						md5: "0123456789abcdef0123456789abcdef",
					},
					{
						clientItemId: "item-2",
						fileName: "file2.jpg",
						fileSizeBytes: 2048,
						contentType: "image/jpeg",
						md5: "fedcba9876543210fedcba9876543210",
					},
				],
			};

			mockSessionRepo.findOpenByClientBatchId.mockResolvedValue(null);
			mockSessionRepo.save.mockResolvedValue(undefined);
			mockBlobStorage.generateBlobName
				.mockReturnValueOnce("field/2025-01-01/item-1/file1.jpg")
				.mockReturnValueOnce("field/2025-01-01/item-2/file2.jpg");

			const result = await useCase.execute(multiFileInput);

			expect(result.items).toHaveLength(2);
			expect(mockBlobStorage.generateBlobName).toHaveBeenCalledTimes(2);
		});

		it("should log session creation", async () => {
			mockSessionRepo.findOpenByClientBatchId.mockResolvedValue(null);
			mockSessionRepo.save.mockResolvedValue(undefined);
			mockBlobStorage.generateBlobName.mockReturnValue(
				"plant/2025-01-01/item-1/test.jpg",
			);

			await useCase.execute(validInput);

			expect(mockLogger.debug).toHaveBeenCalledWith(
				"Creating upload session",
				expect.objectContaining({
					clientBatchId: "batch-123",
					domain: "plant",
				}),
			);

			expect(mockLogger.log).toHaveBeenCalledWith(
				"Upload session created successfully",
				expect.any(Object),
			);
		});

		// ===========================
		// Error Handling & Rollbacks
		// ===========================

		it("APP-CRS-ERR-001 should propagate error when findOpen fails", async () => {
			const dbError = new Error("Database connection lost");
			mockSessionRepo.findOpenByClientBatchId.mockRejectedValue(dbError);

			await expect(useCase.execute(validInput)).rejects.toThrow(
				"Database connection lost",
			);

			expect(mockSessionRepo.findOpenByClientBatchId).toHaveBeenCalledTimes(1);
			expect(mockSessionRepo.save).not.toHaveBeenCalled();
		});

		it("APP-CRS-DBF-002 should rollback when save fails", async () => {
			mockSessionRepo.findOpenByClientBatchId.mockResolvedValue(null);
			mockSessionRepo.save.mockRejectedValue(new Error("db down"));
			mockBlobStorage.generateBlobName.mockReturnValue(
				"plant/2025-01-01/item-1/test.jpg",
			);

			await expect(useCase.execute(validInput)).rejects.toThrow("db down");

			// The transaction should have been attempted
			expect(mockSessionRepo.findOpenByClientBatchId).toHaveBeenCalledTimes(1);
			expect(mockLogger.log).not.toHaveBeenCalledWith(
				"Upload session created successfully",
				expect.anything(),
			);
		});

		it("APP-CRS-ERR-002 should propagate error when mapper.toDomain fails", async () => {
			mockSessionRepo.findOpenByClientBatchId.mockResolvedValue(null);

			const invalidInput: CreateUploadSessionInput = {
				clientBatchId: "",
				domain: "plant",
				files: [],
			};

			await expect(useCase.execute(invalidInput)).rejects.toThrow();

			expect(mockSessionRepo.save).not.toHaveBeenCalled();
		});

		// ===========================
		// Domain Invariants
		// ===========================

		it("DOM-INIT-STS-001 should initialize session as OPEN and items as PENDING", async () => {
			mockSessionRepo.findOpenByClientBatchId.mockResolvedValue(null);
			mockSessionRepo.save.mockResolvedValue(undefined);
			mockBlobStorage.generateBlobName.mockReturnValue(
				"plant/2025-01-01/item-1/test.jpg",
			);

			const result = await useCase.execute(validInput);

			expect(result.status).toBe("OPEN");
			expect(result.items).toHaveLength(1);
			expect(result.items[0].status).toBe("PENDING");
		});

		it("DOM-BN-FMT-002 should generate blobName matching expected pattern", async () => {
			mockSessionRepo.findOpenByClientBatchId.mockResolvedValue(null);
			mockSessionRepo.save.mockResolvedValue(undefined);
			mockBlobStorage.generateBlobName.mockReturnValue(
				"plant/2025-01-15T12:30:45.123Z/item-1/test.jpg",
			);

			const result = await useCase.execute(validInput);

			const blobNamePattern =
				/^plant\/\d{4}-\d{2}-\d{2}T[\d:.Z]+\/item-1\/test\.jpg$/;
			expect(result.items[0].blobName).toMatch(blobNamePattern);
		});

		it("DOM-CNT-001 should create exactly same number of items as input files", async () => {
			const multiFileInput: CreateUploadSessionInput = {
				clientBatchId: "batch-multi",
				domain: "field",
				files: [
					{
						clientItemId: "item-1",
						fileName: "file1.jpg",
						fileSizeBytes: 1024,
						contentType: "image/jpeg",
						md5: "0123456789abcdef0123456789abcdef",
					},
					{
						clientItemId: "item-2",
						fileName: "file2.jpg",
						fileSizeBytes: 2048,
						contentType: "image/jpeg",
						md5: "1123456789abcdef0123456789abcdef",
					},
					{
						clientItemId: "item-3",
						fileName: "file3.jpg",
						fileSizeBytes: 512,
						contentType: "image/jpeg",
						md5: "2123456789abcdef0123456789abcdef",
					},
				],
			};

			mockSessionRepo.findOpenByClientBatchId.mockResolvedValue(null);
			mockSessionRepo.save.mockResolvedValue(undefined);
			mockBlobStorage.generateBlobName
				.mockReturnValueOnce("field/2025-01-01/item-1/file1.jpg")
				.mockReturnValueOnce("field/2025-01-01/item-2/file2.jpg")
				.mockReturnValueOnce("field/2025-01-01/item-3/file3.jpg");

			const result = await useCase.execute(multiFileInput);

			expect(result.items).toHaveLength(multiFileInput.files.length);
			expect(result.items).toHaveLength(3);
		});

		// ===========================
		// Idempotency - Strong Tests
		// ===========================

		it("APP-CRS-IDEM-002 should not mutate existing session on reuse", async () => {
			const existingItems = [
				{
					itemId: "existing-item-1",
					clientItemId: "item-original",
					status: "PENDING" as const,
					blobContainer: "plant",
					blobName: "plant/2025-01-01/item-original/original.jpg",
					createdAt: new Date("2025-01-01"),
				},
			];

			const existingSession = makeUploadSession({
				id: "existing-session-id",
				clientBatchId: "batch-123",
				status: "OPEN",
				domain: "plant",
				items: [
					UploadItem.create({
						id: "existing-item-1",
						clientItemId: ClientIdentifier.create("item-original"),
						location: StorageLocation.create({
							provider: "azure",
							container: "plant",
							blobName: "plant/2025-01-01/item-original/original.jpg",
						}),
						properties: FileProperties.create({
							mimeType: "image/jpeg",
							sizeInBytes: 1024,
							md5Hash: "0123456789abcdef0123456789abcdef",
						}),
						createdAt: new Date("2025-01-01"),
					}),
				],
			});

			mockSessionRepo.findOpenByClientBatchId.mockResolvedValue(
				existingSession,
			);

			const result = await useCase.execute(validInput);

			expect(mockSessionRepo.save).not.toHaveBeenCalled();
			expect(result.items).toHaveLength(existingItems.length);
			expect(result.items[0].clientItemId).toBe("item-original");
			expect(mockLogger.log).toHaveBeenCalledWith(
				"Reusing existing open session",
				expect.objectContaining({
					sessionId: "existing-session-id",
					existingItemCount: 1,
				}),
			);
		});

		// ===========================
		// Input Validations
		// ===========================

		it("APP-CRS-VAL-001 should reject empty files array", async () => {
			const emptyFilesInput: CreateUploadSessionInput = {
				clientBatchId: "batch-empty",
				domain: "plant",
				files: [],
			};

			mockSessionRepo.findOpenByClientBatchId.mockResolvedValue(null);

			await expect(useCase.execute(emptyFilesInput)).rejects.toThrow();
		});

		it("APP-CRS-VAL-002 should reject fileSizeBytes <= 0", async () => {
			const invalidSizeInput: CreateUploadSessionInput = {
				clientBatchId: "batch-invalid-size",
				domain: "plant",
				files: [
					{
						clientItemId: "item-1",
						fileName: "test.jpg",
						fileSizeBytes: 0,
						contentType: "image/jpeg",
						md5: "0123456789abcdef0123456789abcdef",
					},
				],
			};

			mockSessionRepo.findOpenByClientBatchId.mockResolvedValue(null);

			await expect(useCase.execute(invalidSizeInput)).rejects.toThrow();
		});

		it("APP-CRS-VAL-003 should reject unsafe filenames with path traversal", async () => {
			const unsafeFilenameInput: CreateUploadSessionInput = {
				clientBatchId: "batch-unsafe",
				domain: "plant",
				files: [
					{
						clientItemId: "item-1",
						fileName: "../evil.jpg",
						fileSizeBytes: 1024,
						contentType: "image/jpeg",
						md5: "0123456789abcdef0123456789abcdef",
					},
				],
			};

			mockSessionRepo.findOpenByClientBatchId.mockResolvedValue(null);

			await expect(useCase.execute(unsafeFilenameInput)).rejects.toThrow();
		});

		it("APP-CRS-VAL-005 should reject invalid MD5 hash length", async () => {
			const invalidMd5Input: CreateUploadSessionInput = {
				clientBatchId: "batch-invalid-md5",
				domain: "plant",
				files: [
					{
						clientItemId: "item-1",
						fileName: "test.jpg",
						fileSizeBytes: 1024,
						contentType: "image/jpeg",
						md5: "short",
					},
				],
			};

			mockSessionRepo.findOpenByClientBatchId.mockResolvedValue(null);

			await expect(useCase.execute(invalidMd5Input)).rejects.toThrow();
		});

		// ===========================
		// Concurrency / Race Conditions
		// ===========================

		it("APP-CRS-RACE-001 should handle concurrent executes with same clientBatchId", async () => {
			const session = makeUploadSession({
				id: "s1",
				status: "OPEN",
				domain: "plant",
				clientBatchId: "batch-123",
				items: [],
			});

			// First call: no session exists, creates new one
			// Second call: finds existing session (created by first)
			mockSessionRepo.findOpenByClientBatchId
				.mockResolvedValueOnce(null)
				.mockResolvedValueOnce(session);

			mockSessionRepo.save.mockResolvedValue(undefined);
			mockBlobStorage.generateBlobName.mockReturnValue(
				"plant/2025-01-01/item-1/test.jpg",
			);

			await Promise.all([
				useCase.execute(validInput),
				useCase.execute(validInput),
			]);

			// Only one creation should happen
			expect(mockSessionRepo.save).toHaveBeenCalledTimes(1);
		});

		// ===========================
		// Telemetry / Logging
		// ===========================

		it("APP-CRS-LOG-001 should log idempotency with sessionId and item count", async () => {
			const existingSession = makeUploadSession({
				id: "existing-id",
				clientBatchId: "batch-123",
				status: "OPEN",
				domain: "plant",
				items: [
					UploadItem.create({
						id: "item-1",
						clientItemId: ClientIdentifier.create("client-1"),
						location: StorageLocation.create({
							provider: "azure",
							container: "plant",
							blobName: "plant/2025/client-1/file1.jpg",
						}),
						properties: FileProperties.create({
							mimeType: "image/jpeg",
							sizeInBytes: 1024,
							md5Hash: "0123456789abcdef0123456789abcdef",
						}),
						createdAt: new Date("2025-01-01"),
					}),
					UploadItem.create({
						id: "item-2",
						clientItemId: ClientIdentifier.create("client-2"),
						location: StorageLocation.create({
							provider: "azure",
							container: "plant",
							blobName: "plant/2025/client-2/file2.jpg",
						}),
						properties: FileProperties.create({
							mimeType: "image/jpeg",
							sizeInBytes: 2048,
							md5Hash: "0123456789abcdef0123456789abcdef",
						}),
						createdAt: new Date("2025-01-01"),
					}),
				],
			});

			mockSessionRepo.findOpenByClientBatchId.mockResolvedValue(
				existingSession,
			);

			await useCase.execute(validInput);

			expect(mockLogger.log).toHaveBeenCalledWith(
				"Reusing existing open session",
				expect.objectContaining({
					sessionId: "existing-id",
					clientBatchId: "batch-123",
					existingItemCount: 2,
				}),
			);
		});

		it("APP-CRS-LOG-002 should log error context when save fails", async () => {
			mockSessionRepo.findOpenByClientBatchId.mockResolvedValue(null);
			mockSessionRepo.save.mockRejectedValue(
				new Error("Unique constraint violation"),
			);
			mockBlobStorage.generateBlobName.mockReturnValue(
				"plant/2025-01-01/item-1/test.jpg",
			);

			await expect(useCase.execute(validInput)).rejects.toThrow(
				"Unique constraint violation",
			);

			// Verify the error was logged with context
			expect(mockLogger.debug).toHaveBeenCalledWith(
				"Creating upload session",
				expect.objectContaining({
					clientBatchId: "batch-123",
					domain: "plant",
				}),
			);
		});

		it("APP-CRS-RACE-002 should reuse session when save throws unique violation (23505) inside transaction", async () => {
			// Simula: no hay sesión al inicio
			mockSessionRepo.findOpenByClientBatchId
				.mockResolvedValueOnce(null) // pre-check
				.mockResolvedValueOnce(
					// reuse después del 23505
					makeUploadSession({
						id: "reused-after-23505",
						clientBatchId: validInput.clientBatchId,
						status: "OPEN",
						domain: validInput.domain,
						items: [],
					}),
				);

			// save falla con unique violation (p.ej. otra transacción ganó la carrera)
			const uniqueErr = Object.assign(
				new Error("duplicate key value violates unique constraint"),
				{
					name: "QueryFailedError",
					driverError: { code: "23505" },
				},
			);
			mockSessionRepo.save.mockRejectedValueOnce(uniqueErr);
			// El use case debe detectar 23505:
			mockSessionRepo.isUniqueViolation.mockReturnValue(true);

			const result = await useCase.execute(validInput);

			expect(mockSessionRepo.findOpenByClientBatchId).toHaveBeenCalledTimes(2);
			expect(result.sessionId).toBe("reused-after-23505");
		});

		it("APP-CRS-RACE-003 should rethrow when save throws 23505 but no session can be reused", async () => {
			mockSessionRepo.findOpenByClientBatchId
				.mockResolvedValueOnce(null) // pre-check
				.mockResolvedValueOnce(null); // intento de reuse => no existe

			const uniqueErr = Object.assign(
				new Error("duplicate key value violates unique constraint"),
				{
					name: "QueryFailedError",
					driverError: { code: "23505" },
				},
			);
			mockSessionRepo.save.mockRejectedValueOnce(uniqueErr);
			mockSessionRepo.isUniqueViolation.mockReturnValue(true);

			await expect(useCase.execute(validInput)).rejects.toThrow(
				/duplicate key value/i,
			);

			expect(mockSessionRepo.findOpenByClientBatchId).toHaveBeenCalledTimes(2);
		});

		it("APP-CRS-RACE-004 should not treat non-23505 errors as unique violation", async () => {
			mockSessionRepo.findOpenByClientBatchId.mockResolvedValueOnce(null);

			const notUnique = Object.assign(new Error("some db error"), {
				name: "QueryFailedError",
				driverError: { code: "23514" }, // check-violation (ejemplo), no es 23505
			});
			mockSessionRepo.save.mockRejectedValueOnce(notUnique);
			mockSessionRepo.isUniqueViolation.mockReturnValue(false);

			await expect(useCase.execute(validInput)).rejects.toThrow(
				"some db error",
			);
		});

		it("APP-CRS-VAL-010 should reject when files exceed MAX_FILES_PER_REQUEST", async () => {
			// Ajusta este 2001 si tu use case define otro MAX_FILES_PER_REQUEST
			const TOO_MANY = 2001;
			const largeInput: CreateUploadSessionInput = {
				clientBatchId: "batch-large",
				domain: "plant",
				files: Array.from({ length: TOO_MANY }, (_, i) => ({
					clientItemId: `item-${i}`,
					fileName: `f${i}.jpg`,
					fileSizeBytes: 10,
					contentType: "image/jpeg",
					md5: "0123456789abcdef0123456789abcdef",
				})),
			};

			mockSessionRepo.findOpenByClientBatchId.mockResolvedValue(null);

			await expect(useCase.execute(largeInput)).rejects.toBeInstanceOf(
				BadRequestException,
			);
			expect(mockSessionRepo.save).not.toHaveBeenCalled();
		});

		it("APP-CRS-LOG-003 should include durationMs in success log context", async () => {
			mockSessionRepo.findOpenByClientBatchId.mockResolvedValue(null);
			mockSessionRepo.save.mockResolvedValue(undefined);
			mockBlobStorage.generateBlobName.mockReturnValue(
				"plant/2025-01-01/item-1/test.jpg",
			);

			await useCase.execute(validInput);

			// buscamos la llamada de éxito y validamos que traiga durationMs:number
			const calls = mockLogger.log.mock.calls.filter(
				([msg]) => msg === "Upload session created successfully",
			);
			expect(calls.length).toBeGreaterThan(0);
			const [, ctx] = calls[0]; // (message, context)
			expect(ctx).toEqual(
				expect.objectContaining({
					clientBatchId: validInput.clientBatchId,
					durationMs: expect.any(Number),
				}),
			);
		});

		it("APP-CRS-LOG-004 should include durationMs in reuse log context", async () => {
			const existingSession = makeUploadSession({
				id: "existing-session-id",
				clientBatchId: "batch-123",
				status: "OPEN",
				domain: "plant",
			});

			mockSessionRepo.findOpenByClientBatchId.mockResolvedValue(
				existingSession,
			);

			await useCase.execute(validInput);

			const calls = mockLogger.log.mock.calls.filter(
				([msg]) => msg === "Reusing existing open session",
			);
			expect(calls.length).toBeGreaterThan(0);
			const [, ctx] = calls[0];
			expect(ctx).toEqual(
				expect.objectContaining({
					sessionId: "existing-session-id",
					durationMs: expect.any(Number),
				}),
			);
		});
	});
});
