import {
	IsString,
	IsOptional,
	IsArray,
	ValidateNested,
	MaxLength,
	IsEnum,
	IsDefined,
	ArrayMinSize,
	IsHash,
	ArrayMaxSize,
	Max,
	ArrayUnique,
} from "class-validator";
import { Transform, Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Trim } from "@shared/decorators/trim.decorator";
import { UploadDomain } from "./shared-types";
import {
	IsSecureFileName,
	IsSecureUUID,
	IsSecureContentType,
	IsPositiveInteger,
	UUID_V4,
} from "@shared/validators";

export class UploadFileDto {
	@ApiProperty({
		description: "Unique identifier for the file from the client side",
		example: "550e8400-e29b-41d4-a716-446655440000",
		format: "uuid",
		pattern: UUID_V4,
	})
	@Trim()
	@IsDefined({ message: "clientItemId is required" })
	@IsSecureUUID()
	readonly clientItemId: string;

	@ApiProperty({
		description: "Original filename (no path, secure ASCII-only)",
		example: "image.webp",
		maxLength: 255,
	})
	@IsDefined({ message: "fileName is required" })
	@IsSecureFileName({ maxLength: 255 })
	readonly fileName: string;

	@ApiProperty({
		description: "File size in bytes (integer >= 1, max 1MB)",
		example: 1_024_000,
		minimum: 1,
		maximum: 1_048_576,
		type: Number,
	})
	@Type(() => Number)
	@IsPositiveInteger()
	@IsDefined({ message: "fileSizeBytes is required" })
	@Max(1_048_576, {
		message: "File size must not exceed 1MB (1,048,576 bytes)",
	})
	readonly fileSizeBytes: number;

	@ApiPropertyOptional({
		description:
			"MIME type of the file (whitelist: image/jpeg, image/webp, image/jpg)",
		example: "image/jpeg",
		maxLength: 100,
	})
	@Trim()
	@IsSecureContentType({ whitelist: ["image/jpeg", "image/webp", "image/jpg"] })
	readonly contentType!: string;

	@ApiPropertyOptional({
		description: "MD5 hash (32 hex)",
		example: "d41d8cd98f00b204e9800998ecf8427e",
		format: "md5",
	})
	@Trim()
	@IsHash("md5")
	readonly md5!: string;
}

export class CreateUploadSessionDto {
	@ApiProperty({
		description: "Domain for the upload session",
		example: "plant",
		enum: UploadDomain,
		enumName: "UploadDomain",
	})
	@IsDefined({ message: "domain is required" }) // <- exige presencia
	@Transform(({ value }) =>
		typeof value === "string" ? value.trim().toLowerCase() : value,
	)
	@IsEnum(UploadDomain, {
		message: `domain must be one of: ${Object.values(UploadDomain).join(", ")}`,
	})
	readonly domain: UploadDomain;

	@ApiProperty({
		description: "Client-side batch identifier for grouping related uploads",
		example: "550e8400-e29b-41d4-a716-446655440000",
		format: "uuid",
		pattern: UUID_V4,
	})
	@Trim()
	@IsDefined({ message: "clientBatchId is required" })
	@IsSecureUUID()
	readonly clientBatchId!: string;

	@ApiProperty({
		description: "List of files to upload in this session",
		type: [UploadFileDto],
		minItems: 1,
		maxItems: 100,
	})
	@IsArray()
	@ArrayMinSize(1, { message: "At least 1 file is required" })
	@ArrayMaxSize(100, { message: "Maximum 100 files per batch allowed" })
	@ValidateNested({ each: true })
	@Type(() => UploadFileDto)
	@ArrayUnique((f: UploadFileDto) => f.clientItemId, {
		message: "files.clientItemId must be unique",
	})
	readonly files: UploadFileDto[];

	@ApiPropertyOptional({
		description: "Optional session description",
		maxLength: 500,
	})
	@Trim()
	@IsOptional()
	@IsString()
	@MaxLength(500)
	readonly description?: string;
}
