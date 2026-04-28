/**
 * Data structure for a signed URL generated for a single object.
 *
 * @remarks
 * This is a plain data object without logic or framework decorators.
 */
export interface SignedUrl {
	/**
	 * The unique object key (e.g., file path) to which this URL corresponds.
	 */
	readonly objectKey: string;

	/**
	 * The complete temporary signed URL for uploading.
	 */
	readonly signedUrl: string;

	/**
	 * The permanent canonical URL of the object in storage.
	 *
	 * @remarks
	 * This URL can be used to access the object after upload completion,
	 * but may require authentication depending on storage configuration.
	 */
	readonly objectUrl: string;

	/**
	 * The timestamp when the signed URL expires.
	 *
	 * @remarks
	 * Uses Date type to maintain type richness in the application layer.
	 * Serialization to ISO string is handled at the presentation layer.
	 */
	readonly expiresOn: Date;

	/**
	 * The MIME type associated with the signed URL.
	 */
	readonly contentType?: string;
}

/**
 * Output DTO for the GetSasBatchUseCase.
 *
 * @remarks
 * Represents the operation result containing the batch of signed URLs
 * for client-side file uploads.
 */
export interface GetSasBatchOutput {
	/** Array of generated signed URLs */
	readonly urls: readonly SignedUrl[];
}
