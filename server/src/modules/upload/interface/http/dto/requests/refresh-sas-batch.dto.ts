import {
	IsArray,
	ArrayMinSize,
	ValidateNested,
	ArrayUnique,
	IsDefined,
	IsOptional,
} from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Trim } from "@shared/decorators/trim.decorator";
import { IsSecureBlobPath, IsSecureContentType } from "@shared/validators";

export class RefreshSasDto {
	@ApiProperty({
		description:
			"Secure blob path for SAS refresh (no traversal, no backslashes)",
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

export class RefreshSasBatchDto {
	@ApiProperty({
		description: "List of items for which to refresh SAS tokens",
		type: [RefreshSasDto],
		minItems: 1,
	})
	@IsArray()
	@ArrayMinSize(1)
	@ValidateNested({ each: true })
	@Type(() => RefreshSasDto)
	@ArrayUnique((i: RefreshSasDto) => i.blobName, {
		message: "items.blobName must be unique",
	})
	readonly items!: RefreshSasDto[];
}
