import {
	UUID,
	UploadItemStatus,
	UploadSessionStatus,
} from "../../../domain/types";

/**
 * Represents a detailed error if item processing fails.
 *
 * @remarks
 * Provides structured error information for debugging and client feedback.
 */
export interface ProcessingErrorOutput {
	/** Error code for categorization and handling */
	readonly code: string;
	/** Human-readable error message */
	readonly message: string;
	/** Additional contextual details about the error */
	readonly details?: Record<string, unknown>;
}

/**
 * Detailed processing result for a single item.
 *
 * @remarks
 * Contains the final status and any verification data or errors.
 */
export interface ItemProcessingResultOutput {
	/** Client-provided identifier for the item */
	readonly clientItemId: string;
	/** Final status after processing */
	readonly finalStatus: UploadItemStatus;
	/** Actual file size in bytes (if verified) */
	readonly sizeBytes?: number;
	/** Actual MD5 hash (if verified) */
	readonly md5?: string;
	/** Error information if processing failed */
	readonly error?: ProcessingErrorOutput;
}

/**
 * Aggregated summary of session processing results.
 *
 * @remarks
 * Provides quick overview of processing outcomes without iterating results.
 */
export interface CompletionSummaryOutput {
	/** Number of items successfully verified */
	readonly verified: number;
	/** Number of items marked as incomplete */
	readonly incomplete: number;
	/** Number of items that failed processing */
	readonly failed: number;
	/** Total number of items processed */
	readonly total: number;
}

/**
 * Output DTO for the CompleteSessionUseCase.
 *
 * @remarks
 * Represents the complete result of the session finalization operation,
 * including per-item results and aggregated summary.
 */
export interface CompleteSessionOutput {
	/** The session ID that was completed */
	readonly sessionId: UUID;
	/** Final status of the session after completion */
	readonly finalStatus: UploadSessionStatus;
	/** Aggregated summary of processing results */
	readonly summary: CompletionSummaryOutput;
	/** Detailed results for each processed item */
	readonly results: readonly ItemProcessingResultOutput[];
}
