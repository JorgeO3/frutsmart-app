import {
	IsOptional,
	IsArray,
	ValidateNested,
	ArrayMinSize,
	ArrayMaxSize,
	ArrayUnique,
	IsDefined,
} from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Trim } from "@shared/decorators/trim.decorator";
import { IsSecureBlobPath, IsSecureContentType } from "@shared/validators";

export class SasItemDto {
	@ApiProperty({
		description:
			"Secure blob path (no traversal, no backslashes, ASCII-only segments)",
		example:
			"plant/2025-01-15T10-30-00-000Z/550e8400-e29b-41d4-a716-446655440000/document.pdf",
		maxLength: 1024,
	})
	@IsDefined({ message: "blobName is required" })
	@Trim()
	@IsSecureBlobPath({ maxLength: 1024 })
	readonly blobName!: string;

	@ApiPropertyOptional({
		description: "MIME type (whitelist: image/jpeg, image/webp, image/jpg)",
		example: "image/jpeg",
		maxLength: 100,
	})
	@Trim()
	@IsOptional()
	@IsSecureContentType({ whitelist: ["image/jpeg", "image/webp", "image/jpg"] })
	readonly contentType?: string;
}

export class GetSasBatchRequestDto {
	@ApiProperty({
		description: "List of items for which to generate SAS tokens",
		type: [SasItemDto],
		minItems: 1,
		maxItems: 100,
	})
	@IsArray()
	@ArrayMinSize(1, { message: "At least 1 item is required" })
	@ArrayMaxSize(100, { message: "Maximum 100 items per batch allowed" })
	@ValidateNested({ each: true })
	@Type(() => SasItemDto)
	@ArrayUnique((i: SasItemDto) => i.blobName, {
		message: "items.blobName must be unique",
	})
	readonly items!: SasItemDto[];
}
