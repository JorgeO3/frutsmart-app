import { UUID } from "../../../domain/types";

/**
 * Data structure for requesting a signed URL refresh for a single object.
 *
 * @remarks
 * Used when existing signed URLs are expired or about to expire.
 */
export interface RefreshSasItemInput {
	/**
	 * The unique object key (e.g., file path) for which to refresh the signed URL.
	 */
	readonly objectKey: string;

	/**
	 * Optional MIME type of the object (e.g., 'image/jpeg', 'application/pdf').
	 */
	readonly contentType?: string;
}

/**
 * Input DTO for the RefreshSasUseCase.
 *
 * @remarks
 * Represents the command with parameters needed to refresh one or more signed URLs.
 * This is typically used when upload operations take longer than the initial TTL
 * or when retrying failed uploads.
 */
export interface RefreshSasBatchInput {
	/**
	 * The session ID to which the items belong.
	 */
	readonly sessionId: UUID;

	/**
	 * Array of objects for which to refresh signed URLs.
	 */
	readonly items: readonly RefreshSasItemInput[];
}
