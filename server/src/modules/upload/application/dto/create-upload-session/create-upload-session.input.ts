import { UploadDomain } from "src/modules/upload/domain/types";

/**
 * Data structure for an individual file within the command.
 *
 * @remarks
 * This is a plain data object without logic or framework decorators,
 * maintaining separation between application and infrastructure layers.
 */
export interface FileInput {
	/** Client-provided unique identifier for this file */
	readonly clientItemId: string;
	/** Name of the file including extension */
	readonly fileName: string;
	/** Size of the file in bytes */
	readonly fileSizeBytes: number;
	/** MIME type of the file (e.g., 'image/jpeg', 'application/pdf') */
	readonly contentType: string;
	/** MD5 hash for integrity verification (optional but recommended) */
	readonly md5: string;
}

/**
 * Input DTO for the CreateUploadSessionUseCase.
 *
 * @remarks
 * Represents the command with all information needed to initiate an upload session.
 * This DTO is framework-agnostic and contains no validation decorators, keeping
 * the application layer clean from infrastructure concerns.
 */
export interface CreateUploadSessionInput {
	/** Client-provided unique identifier for this batch of files */
	readonly clientBatchId: string;
	/** Domain or context for the upload session (e.g., 'plant', 'field') */
	readonly domain: UploadDomain;
	/** Array of files to be uploaded in this session */
	readonly files: readonly FileInput[];
}
