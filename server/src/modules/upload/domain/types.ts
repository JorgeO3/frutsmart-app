/**
 * A type alias for UUID strings.
 */
export type UUID = string;

/**
 * Possible values for different storage providers.
 */
export const StorageProviderValues = ["azure", "s3", "gcs"] as const;

/**
 * Represents the possible storage providers.
 * - azure: Microsoft Azure Blob Storage
 * - s3: Amazon Simple Storage Service (S3)
 * - gcs: Google Cloud Storage
 */
export type StorageProvider = (typeof StorageProviderValues)[number];

/**
 * Properties required to define a storage location.
 */
export const UploadSessionStatusValues = [
	"OPEN",
	"COMPLETED",
	"FAILED",
	"CANCELLED",
] as const;

/**
 * Represents the possible statuses for an upload session.
 * - OPEN: The session is open and can accept uploads.
 * - COMPLETED: The session has been completed successfully.
 * - FAILED: The session has failed.
 * - CANCELLED: The session has been cancelled.
 */
export type UploadSessionStatus = (typeof UploadSessionStatusValues)[number];

/**
 * Possible values for different upload item statuses.
 */
export const UploadItemStatusValues = [
	"PENDING",
	"IN_PROGRESS",
	"UPLOADED",
	"VERIFIED",
	"FAILED",
	"ABORTED",
] as const;

/**
 * Represents the possible statuses for an upload item.
 * - PENDING: The upload is waiting to start.
 * - IN_PROGRESS: The upload is currently in progress.
 * - UPLOADED: The upload has completed successfully.
 * - VERIFIED: The uploaded item has been verified.
 * - FAILED: The upload failed.
 * - ABORTED: The upload was aborted.
 */
export type UploadItemStatus = (typeof UploadItemStatusValues)[number];

/**
 * Represents the possible domains for an upload.
 * - plant: Uploads related to the work done by workers in the plant (processing facility).
 * - field: Uploads related to the work done by some workers in the field (outdoor area).
 */
export const UploadDomainValues = ["plant", "field"] as const;

/**
 * Represents the domain or context of the upload.
 * This can be used to categorize uploads based on their purpose or origin.
 * - plant: Uploads related to the work done by workers in the plant (processing facility).
 * - field: Uploads related to the work done by some workers in the field (outdoor area).
 */
export type UploadDomain = (typeof UploadDomainValues)[number];
