import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsString, MinLength } from "class-validator";
import { IsSecureUUID, UUID_V4 } from "@shared/validators";
import { Trim } from "@shared/decorators/trim.decorator";
import { MODEL_TYPES, type ModelType } from "../../../../domain/types";

export class CreateModelDto {
	@ApiProperty({
		description: "Model unique identifier",
		example: "550e8400-e29b-41d4-a716-446655440000",
		format: "uuid",
		pattern: UUID_V4,
	})
	@Trim()
	@IsSecureUUID()
	readonly id!: string;

	@ApiProperty({
		description: "Model name",
		example: "YOLOv8",
		minLength: 1,
	})
	@Trim()
	@IsString()
	@MinLength(1)
	readonly name!: string;

	@ApiProperty({
		description: "Model version tag",
		example: "v1.0.0",
		minLength: 1,
	})
	@Trim()
	@IsString()
	@MinLength(1)
	readonly versionTag!: string;

	@ApiProperty({
		description: "Model type",
		enum: MODEL_TYPES,
		enumName: "ModelType",
		example: "detection",
	})
	@IsEnum(MODEL_TYPES, {
		message: `type must be one of: ${MODEL_TYPES.join(", ")}`,
	})
	readonly type!: ModelType;
}
