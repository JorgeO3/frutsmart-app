import { ApiProperty } from "@nestjs/swagger";
import type { ModelType } from "../../../../domain/types";

export class ModelResponse {
	@ApiProperty({ example: "550e8400-e29b-41d4-a716-446655440000" })
	id!: string;

	@ApiProperty({ example: "YOLOv8" })
	name!: string;

	@ApiProperty({ example: "v1.0.0" })
	versionTag!: string;

	@ApiProperty({
		example: "detection",
		enum: ["detection", "external_classification", "internal_classification"],
	})
	type!: ModelType;
}

export class ProgramResponse {
	@ApiProperty({ example: "550e8400-e29b-41d4-a716-446655440000" })
	id!: string;

	@ApiProperty({ example: "Organic Fruits Program" })
	name!: string;
}

export class LotResponse {
	@ApiProperty({ example: "550e8400-e29b-41d4-a716-446655440000" })
	id!: string;

	@ApiProperty({ example: "Lot A" })
	name!: string;

	@ApiProperty({ example: "550e8400-e29b-41d4-a716-446655440001" })
	programId!: string;
}

export class CenterResponse {
	@ApiProperty({ example: "550e8400-e29b-41d4-a716-446655440000" })
	id!: string;

	@ApiProperty({ example: "Center 1" })
	name!: string;

	@ApiProperty({ example: "550e8400-e29b-41d4-a716-446655440001" })
	lotId!: string;
}

export class ProviderResponse {
	@ApiProperty({ example: "550e8400-e29b-41d4-a716-446655440000" })
	id!: string;

	@ApiProperty({ example: "FruitCorp Inc." })
	name!: string;
}

export class SubProviderResponse {
	@ApiProperty({ example: "550e8400-e29b-41d4-a716-446655440000" })
	id!: string;

	@ApiProperty({ example: "FruitCorp Division A" })
	name!: string;

	@ApiProperty({ example: "550e8400-e29b-41d4-a716-446655440001" })
	providerId!: string;
}
