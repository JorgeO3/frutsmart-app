import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

import { Type } from "class-transformer";

import {
	type UploadDomain,
	UploadDomainValues,
	type UploadItemStatus,
	UploadItemStatusValues,
	type UploadSessionStatus,
	UploadSessionStatusValues,
} from "@modules/upload/domain/types";
import { ProblemDetails } from "./shared-response-types";

export class SessionStatusItemResponse {
	@ApiProperty({
		description: "Server-side upload item ID",
		example: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
		format: "uuid",
	})
	itemId!: string;

	@ApiProperty({
		description: "Client-side item identifier",
		example: "file-001",
		maxLength: 255,
	})
	clientItemId!: string;

	@ApiProperty({
		description: "Current item status",
		enum: UploadItemStatusValues,
		enumName: "UploadItemStatus",
		example: "IN_PROGRESS" as UploadItemStatus,
	})
	status!: UploadItemStatus;

	@ApiProperty({
		description: "Azure blob container name",
		example: "frutsmart",
		maxLength: 63,
	})
	blobContainer!: string;

	@ApiProperty({
		description: "Blob path/name within the container",
		example: "frutsmart/2024-01-01T10-00-00-000Z/file-001/document.pdf",
		maxLength: 1024,
	})
	blobName!: string;

	@ApiPropertyOptional({
		description: "Declared or verified file size in bytes",
		example: 1_024_000,
		type: "integer",
		format: "int64",
		minimum: 0,
	})
	sizeBytes?: number;

	@ApiPropertyOptional({
		description: "Declared or verified MD5 (32 hex characters)",
		example: "d41d8cd98f00b204e9800998ecf8427e",
		pattern: "^[a-fA-F0-9]{32}$",
	})
	md5?: string;

	@ApiPropertyOptional({
		description: "Last error message (if any)",
		example: "Blob verification failed",
		maxLength: 1024,
	})
	lastError?: string;

	@ApiPropertyOptional({
		description: "Number of attempts performed",
		example: 2,
		type: "integer",
		minimum: 0,
	})
	attemptCount?: number;

	@ApiPropertyOptional({
		description: "First time the item was seen by the server",
		example: "2024-01-01T10:00:00.000Z",
		format: "date-time",
	})
	firstSeenAt?: string;

	@ApiPropertyOptional({
		description: "Timestamp of the last processing attempt",
		example: "2024-01-01T10:10:00.000Z",
		format: "date-time",
	})
	lastAttemptAt?: string;

	@ApiPropertyOptional({
		description: "Timestamp when the item was uploaded",
		example: "2024-01-01T10:05:00.000Z",
		format: "date-time",
	})
	uploadedAt?: string;

	@ApiPropertyOptional({
		description: "Timestamp when the item was verified",
		example: "2024-01-01T10:12:00.000Z",
		format: "date-time",
	})
	verifiedAt?: string;

	@ApiPropertyOptional({
		description: "Structured problem details for the last error (if any)",
		type: () => ProblemDetails,
	})
	@Type(() => ProblemDetails)
	problem?: ProblemDetails;
}

export class SessionStatusMetaResponse {
	@ApiProperty({
		description: "Upload session ID",
		example: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
		format: "uuid",
	})
	sessionId!: string;

	@ApiProperty({
		description: "Session creation timestamp",
		example: "2024-01-01T10:00:00.000Z",
		format: "date-time",
	})
	createdAt!: string;

	@ApiProperty({
		description: "Upload session domain",
		enum: UploadDomainValues,
		enumName: "UploadDomain",
		example: "plant" as UploadDomain,
	})
	domain!: UploadDomain;

	@ApiPropertyOptional({
		description: "Client-provided batch ID (if used)",
		example: "c1a9b5a2-9d1f-4a1e-9a71-8e5d9f2b1c44",
		format: "uuid",
	})
	clientBatchId?: string;

	@ApiPropertyOptional({
		description: "Client device identifier (if provided)",
		example: "device-1234",
		maxLength: 255,
	})
	deviceId?: string;

	@ApiPropertyOptional({
		description: "Logical session status",
		enum: UploadSessionStatusValues,
		enumName: "UploadSessionStatus",
		example: "OPEN" as UploadSessionStatus,
	})
	status?: UploadSessionStatus;
}

export class SessionStatusCountsResponse {
	@ApiProperty({
		description: "Items in PENDING status",
		example: 3,
		type: "integer",
		minimum: 0,
	})
	pending!: number;

	@ApiProperty({
		description: "Items in IN_PROGRESS status",
		example: 2,
		type: "integer",
		minimum: 0,
	})
	inProgress!: number;

	@ApiProperty({
		description: "Items in UPLOADED status",
		example: 5,
		type: "integer",
		minimum: 0,
	})
	uploaded!: number;

	@ApiProperty({
		description: "Items in VERIFIED status",
		example: 4,
		type: "integer",
		minimum: 0,
	})
	verified!: number;

	@ApiProperty({
		description: "Items in INCOMPLETE status",
		example: 1,
		type: "integer",
		minimum: 0,
	})
	incomplete!: number;

	@ApiProperty({
		description: "Items in FAILED status",
		example: 0,
		type: "integer",
		minimum: 0,
	})
	failed!: number;

	@ApiProperty({
		description: "Items in ABORTED status",
		example: 0,
		type: "integer",
		minimum: 0,
	})
	aborted!: number;

	@ApiProperty({
		description: "Total items",
		example: 15,
		type: "integer",
		minimum: 0,
	})
	total!: number;
}

export class SessionStatusResponse {
	@ApiProperty({
		description: "Session metadata",
		type: () => SessionStatusMetaResponse,
	})
	@Type(() => SessionStatusMetaResponse)
	meta!: SessionStatusMetaResponse;

	@ApiProperty({
		description: "Aggregated counts by status",
		type: () => SessionStatusCountsResponse,
	})
	@Type(() => SessionStatusCountsResponse)
	counts!: SessionStatusCountsResponse;

	@ApiPropertyOptional({
		description: "Detailed items for the current page (if paginated)",
		type: () => [SessionStatusItemResponse],
	})
	@Type(() => SessionStatusItemResponse)
	items?: SessionStatusItemResponse[];

	@ApiPropertyOptional({
		description: "Pagination: returned offset",
		example: 0,
		type: "integer",
		minimum: 0,
	})
	offset?: number;

	@ApiPropertyOptional({
		description: "Pagination: applied limit",
		example: 50,
		type: "integer",
		minimum: 1,
	})
	limit?: number;

	@ApiPropertyOptional({
		description: "Pagination: whether there are more results",
		example: false,
		type: "boolean",
	})
	hasMore?: boolean;
}
