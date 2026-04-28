import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
	type UploadSessionStatus,
	UploadItemStatusValues,
	type UploadItemStatus,
	UploadSessionStatusValues,
} from "../../../../domain/types";

export class UploadItemResponse {
	@ApiProperty({
		description: "Unique identifier for the upload item",
		example: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
		format: "uuid",
	})
	readonly itemId!: string;

	@ApiProperty({
		description: "Client-provided identifier for the item",
		example: "file-001",
		maxLength: 255,
	})
	readonly clientItemId!: string;

	@ApiProperty({
		description: "Current status of the upload item",
		enum: UploadItemStatusValues,
		enumName: "UploadItemStatus",
		example: "PENDING" as UploadItemStatus,
	})
	readonly status!: UploadItemStatus;

	@ApiProperty({
		description: "Azure blob container name",
		example: "frutsmart",
		maxLength: 63,
	})
	readonly blobContainer!: string;

	@ApiProperty({
		description: "Name of the blob in Azure storage",
		example: "frutsmart/2024-01-01T10-00-00-000Z/file-001/document.pdf",
		maxLength: 1024,
	})
	readonly blobName!: string;

	@ApiProperty({
		description: "Timestamp when the item was created",
		example: "2024-01-01T10:00:00.000Z",
		format: "date-time",
	})
	readonly createdAt!: string;
}

export class CreateUploadSessionResponse {
	@ApiProperty({
		description: "Unique identifier for the upload session",
		example: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
		format: "uuid",
	})
	readonly sessionId!: string;

	@ApiProperty({
		description: "Domain for the upload session",
		enum: ["plant", "field"],
		enumName: "UploadDomain",
		example: "plant",
	})
	readonly domain!: "plant" | "field";

	@ApiPropertyOptional({
		description: "Client-provided batch identifier",
		example: "batch-2024-001",
		maxLength: 100,
	})
	readonly clientBatchId?: string;

	@ApiProperty({
		description: "Current status of the session",
		enum: UploadSessionStatusValues,
		enumName: "UploadSessionStatus",
		example: "OPEN" as UploadSessionStatus,
	})
	readonly status!: UploadSessionStatus;

	@ApiProperty({
		description: "Timestamp when the session was created",
		example: "2024-01-01T10:00:00.000Z",
		format: "date-time",
	})
	readonly createdAt!: string;

	@ApiPropertyOptional({
		description: "Session description",
		example: "Upload session for batch processing",
		maxLength: 500,
	})
	readonly description?: string;

	@ApiProperty({
		description: "List of upload items in this session",
		type: () => [UploadItemResponse],
	})
	@Type(() => UploadItemResponse)
	readonly items!: UploadItemResponse[];
}
