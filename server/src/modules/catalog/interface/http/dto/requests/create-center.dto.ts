import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";
import { IsSecureUUID, UUID_V4 } from "@shared/validators";
import { Trim } from "@shared/decorators/trim.decorator";

export class CreateCenterDto {
	@ApiProperty({
		description: "Center unique identifier",
		example: "550e8400-e29b-41d4-a716-446655440000",
		format: "uuid",
		pattern: UUID_V4,
	})
	@Trim()
	@IsSecureUUID()
	readonly id!: string;

	@ApiProperty({
		description: "Center name",
		example: "Center 1",
		minLength: 1,
	})
	@Trim()
	@IsString()
	@MinLength(1)
	readonly name!: string;

	@ApiProperty({
		description: "Lot ID that this center belongs to",
		example: "550e8400-e29b-41d4-a716-446655440001",
		format: "uuid",
		pattern: UUID_V4,
	})
	@Trim()
	@IsSecureUUID()
	readonly lotId!: string;
}
