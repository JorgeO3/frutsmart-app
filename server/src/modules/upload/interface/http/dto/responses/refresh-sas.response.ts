import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";

export class RefreshSasEntryResponse {
	@ApiProperty({
		description: "Blob path/name within the container",
		example: "frutsmart/2024-01-01T10-00-00-000Z/file-001/document.pdf",
		maxLength: 1024,
	})
	readonly blobName!: string;

	@ApiProperty({
		description: "Full SAS URL to upload to the blob",
		example:
			"https://storage.blob.core.windows.net/container/blob?sv=2023-01-03&se=2024-01-01T11%3A00%3A00Z&sr=b&sp=cw&sig=...",
		format: "uri",
		maxLength: 4096,
	})
	readonly url!: string;

	@ApiProperty({
		description: "Direct blob URL without SAS token",
		example: "https://storage.blob.core.windows.net/container/blob",
		format: "uri",
		maxLength: 2048,
	})
	readonly blobUrl!: string;

	@ApiProperty({
		description: "ISO timestamp when the SAS token expires",
		example: "2024-01-01T11:00:00.000Z",
		format: "date-time",
	})
	readonly expiresOn!: string;

	@ApiPropertyOptional({
		description: "MIME content type suggested/used for the blob",
		example: "application/pdf",
		maxLength: 100,
	})
	readonly contentType?: string;
}

export class RefreshSasBatchResponse {
	@ApiProperty({
		description: "List of refreshed SAS token entries",
		type: () => [RefreshSasEntryResponse],
	})
	@Type(() => RefreshSasEntryResponse)
	readonly sas!: RefreshSasEntryResponse[];
}
