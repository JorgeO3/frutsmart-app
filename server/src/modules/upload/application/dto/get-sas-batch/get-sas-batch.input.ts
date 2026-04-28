import { UUID } from "../../../domain/types";

/**
 * Data structure for requesting a signed URL for a single object.
 *
 * @remarks
 * This is a pure data structure without coupling to any framework.
 */
export interface SasBatchItem {
	/**
	 * The unique object key (e.g., file path) for which a signed URL is requested.
	 * In Azure Blob Storage, this corresponds to the blob name.
	 */
	readonly objectKey: string;

	/**
	 * Optional MIME type of the object (e.g., 'image/jpeg', 'application/pdf').
	 */
	readonly contentType?: string;
}

/**
 * Input DTO for the GetSasBatchUseCase.
 *
 * @remarks
 * Represents the command with parameters needed to obtain a batch of signed URLs
 * for direct client-to-storage uploads.
 */
export interface GetSasBatchInput {
	/**
	 * The session ID to which the items belong.
	 */
	readonly sessionId: UUID;

	/**
	 * Optional time-to-live (TTL) for the signed URLs in minutes.
	 */
	readonly ttlMinutes?: number;

	/**
	 * Array of objects for which signed URLs are needed.
	 */
	readonly items: readonly SasBatchItem[];
}
