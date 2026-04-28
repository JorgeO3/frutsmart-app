/**
 * Data structure for a refreshed signed URL for a single object.
 *
 * @remarks
 * Contains the new signed URL with updated expiration time.
 */
export interface RefreshedSignedUrlOutput {
	/**
	 * The unique object key to which this URL corresponds.
	 */
	readonly objectKey: string;

	/**
	 * The new complete temporary signed URL for uploading.
	 */
	readonly signedUrl: string;

	/**
	 * The permanent canonical URL of the object in storage.
	 */
	readonly objectUrl: string;

	/**
	 * The timestamp when the new signed URL expires.
	 */
	readonly expiresOn: Date;

	/**
	 * The MIME type associated with the signed URL.
	 */
	readonly contentType?: string;
}

/**
 * Output DTO for the RefreshSasUseCase.
 *
 * @remarks
 * Represents the operation result containing the batch of refreshed signed URLs.
 */
export interface RefreshSasBatchOutput {
	/** Array of refreshed signed URLs */
	readonly urls: readonly RefreshedSignedUrlOutput[];
}
