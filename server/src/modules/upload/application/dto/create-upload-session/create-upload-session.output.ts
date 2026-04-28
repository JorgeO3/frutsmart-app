import {
	UUID,
	UploadSessionStatus,
	UploadItemStatus,
	UploadDomain,
} from "../../../domain/types";

/**
 * Data structure for a created item as part of the use case result.
 *
 * @remarks
 * This is a plain data object without logic or framework decorators.
 */
export interface CreatedItemOutput {
	/** Unique identifier for the created item */
	readonly itemId: UUID;
	/** Client-provided identifier for this item */
	readonly clientItemId: string;
	/** Current status of the item */
	readonly status: UploadItemStatus;
	/** Storage container name where the file will be uploaded */
	readonly blobContainer: string;
	/** Storage blob name (key/path) for the file */
	readonly blobName: string;
	/** Timestamp when the item was created */
	readonly createdAt: Date;
}

/**
 * Output DTO for the CreateUploadSessionUseCase.
 *
 * @remarks
 * Represents the pure result of the operation, ready to be transformed by a Presenter.
 * Uses domain types (UUID, Date) instead of serialization primitives (string) to maintain
 * type richness in the application layer. Serialization concerns are handled at the
 * presentation/infrastructure layer.
 */
export interface CreateUploadSessionOutput {
	/** Unique identifier for the created session */
	readonly sessionId: UUID;
	/** Client-provided batch identifier */
	readonly clientBatchId: string;
	/** Domain or context for the upload session (e.g., 'plant', 'field') */
	readonly domain: UploadDomain;
	/** Current status of the session */
	readonly status: UploadSessionStatus;
	/** Timestamp when the session was created */
	readonly createdAt: Date;
	/** Array of created items within this session */
	readonly items: readonly CreatedItemOutput[];
}
