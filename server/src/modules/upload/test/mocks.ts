import { ILogger } from "../application/ports/logger.port";
import {
	ITransactionManager,
	TxOptions,
} from "../application/ports/transaction-manager.port";
import { IUploadSessionsRepository } from "../application/ports/repositories/upload-sessions.repo.port";
import { IUploadItemsRepository } from "../application/ports/repositories/upload-items.repo.port";
import { IBlobStorage } from "../application/ports/blob-storage.port";
import { IUuidGenerator } from "../application/ports/uuid-generator.port";

/**
 * Mock implementation of ILogger for testing
 */
export class MockLogger implements ILogger {
	log = jest.fn();
	error = jest.fn();
	warn = jest.fn();
	debug = jest.fn();
	verbose = jest.fn();
}

/**
 * Mock implementation of ITransactionManager for testing
 */
export class MockTransactionManager implements ITransactionManager {
	async runInTransaction<T>(
		work: (manager: unknown) => Promise<T>,
		_options?: TxOptions,
	): Promise<T> {
		return work(null);
	}
}

/**
 * Mock implementation of IUploadSessionsRepository for testing
 */
export class MockUploadSessionsRepository implements IUploadSessionsRepository {
	findById = jest.fn();
	findOpenByClientBatchId = jest.fn();
	save = jest.fn();
	update = jest.fn();
	// biome-ignore format: true
	isUniqueViolation = jest.fn<
    ReturnType<() => boolean>,
    Parameters<() => boolean>
  >();
}

/**
 * Mock implementation of IUploadItemsRepository for testing
 */
export class MockUploadItemsRepository implements IUploadItemsRepository {
	findById = jest.fn();
	findByIds = jest.fn();
	save = jest.fn();
	saveMany = jest.fn();
	update = jest.fn();
	updateMany = jest.fn();
}

/**
 * Mock implementation of IBlobStorage for testing
 */
export class MockBlobStorage implements IBlobStorage {
	generateDownloadUrls = jest.fn();
	listObjectsByPrefix = jest.fn();
	generateUploadUrls = jest.fn();
	getObjectMetadata = jest.fn();
	generateBlobName = jest.fn(
		(domain: string, clientItemId: string, fileName: string) =>
			`${domain}/2025-01-01/${clientItemId}/${fileName}`,
	);
}

/**
 * Mock implementation of IUuidGenerator for testing
 */
export class MockUuidGenerator implements IUuidGenerator {
	generate = jest.fn(() => `uuid-${Math.random().toString(36).substring(7)}`);
}

/**
 * Reset all mocks - call this in beforeEach
 */
export function resetAllMocks(...mocks: jest.Mock[]) {
	mocks.forEach((mock) => {
		Object.values(mock).forEach((value) => {
			if (typeof value === "function" && "mockReset" in value) {
				(value as jest.Mock).mockReset();
			}
		});
	});
}
