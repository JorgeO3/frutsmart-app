import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
	type UploadItemStatus,
	UploadItemStatusValues,
	type UploadSessionStatus,
	UploadSessionStatusValues,
} from "src/modules/upload/domain/types";

export class ProcessingResultError {
	@ApiPropertyOptional({
		description: "Error code",
		example: "VERIFICATION_FAILED",
		// You can turn this into an enum later for stricter docs:
		// enum: ProcessingErrorCode,
		// enumName: 'ProcessingErrorCode',
	})
	code?: string;

	@ApiPropertyOptional({
		description: "Human-readable error message",
		example: "Blob verification failed",
	})
	message?: string;

	@ApiPropertyOptional({
		description: "Additional error details as JSON object",
		example: { detail: "The uploaded blob could not be verified" },
		type: "object",
		additionalProperties: true,
	})
	detailsJson?: Record<string, unknown>;
}

export class CompleteSessionItemResult {
	@ApiProperty({
		description: "Client-provided identifier for the file",
		example: "file-001",
		maxLength: 255,
	})
	clientItemId!: string;

	@ApiProperty({
		description: "Final status of the upload item after processing",
		enum: UploadItemStatusValues,
		enumName: "UploadItemStatus",
		example: "VERIFIED" as UploadItemStatus,
	})
	finalStatus!: UploadItemStatus;

	@ApiPropertyOptional({
		description: "File size in bytes (present if the item was verified)",
		example: 1_024_000,
		type: "integer",
		format: "int64",
		minimum: 0,
	})
	sizeBytes?: number;

	@ApiPropertyOptional({
		description: "MD5 hash of the verified file (32 hex chars)",
		example: "d41d8cd98f00b204e9800998ecf8427e",
		pattern: "^[a-fA-F0-9]{32}$",
	})
	md5?: string;

	@ApiPropertyOptional({
		description: "Error details if processing failed",
		type: () => ProcessingResultError,
	})
	@Type(() => ProcessingResultError)
	error?: ProcessingResultError;
}

export class CompleteSessionSummaryResponse {
	@ApiProperty({
		description: "Number of items successfully verified",
		example: 5,
		type: "integer",
		minimum: 0,
	})
	verified!: number;

	@ApiProperty({
		description: "Number of items that are incomplete",
		example: 1,
		type: "integer",
		minimum: 0,
	})
	incomplete!: number;

	@ApiProperty({
		description: "Number of items that failed processing",
		example: 0,
		type: "integer",
		minimum: 0,
	})
	failed!: number;

	@ApiProperty({
		description: "Total number of items processed",
		example: 6,
		type: "integer",
		minimum: 0,
	})
	total!: number;
}

export class CompleteSessionResponse {
	@ApiProperty({
		description: "ID of the upload session",
		example: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
		format: "uuid",
	})
	sessionId!: string;

	@ApiProperty({
		description: "Final status of the session after completion",
		enum: UploadSessionStatusValues,
		enumName: "UploadSessionStatus",
		example: "COMPLETED" as UploadSessionStatus,
	})
	finalStatus!: UploadSessionStatus;

	@ApiProperty({
		description: "Summary of processing results",
		type: () => CompleteSessionSummaryResponse,
	})
	@Type(() => CompleteSessionSummaryResponse)
	summary!: CompleteSessionSummaryResponse;

	@ApiProperty({
		description: "Detailed results for each processed item",
		type: () => [CompleteSessionItemResult],
	})
	@Type(() => CompleteSessionItemResult)
	results!: CompleteSessionItemResult[];
}
