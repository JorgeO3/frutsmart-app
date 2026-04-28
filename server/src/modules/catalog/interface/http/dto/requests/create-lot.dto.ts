import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";
import { IsSecureUUID, UUID_V4 } from "@shared/validators";
import { Trim } from "@shared/decorators/trim.decorator";

export class CreateLotDto {
	@ApiProperty({
		description: "Lot unique identifier",
		example: "550e8400-e29b-41d4-a716-446655440000",
		format: "uuid",
		pattern: UUID_V4,
	})
	@Trim()
	@IsSecureUUID()
	readonly id!: string;

	@ApiProperty({
		description: "Lot name",
		example: "Lot A",
		minLength: 1,
	})
	@Trim()
	@IsString()
	@MinLength(1)
	readonly name!: string;

	@ApiProperty({
		description: "Program ID that this lot belongs to",
		example: "550e8400-e29b-41d4-a716-446655440001",
		format: "uuid",
		pattern: UUID_V4,
	})
	@Trim()
	@IsSecureUUID()
	readonly programId!: string;
}
