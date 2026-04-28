import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
	ArrayMinSize,
	ArrayUnique,
	IsArray,
	IsBoolean,
	IsDefined,
	IsEnum,
	IsInt,
	IsNumber,
	IsObject,
	IsOptional,
	IsString,
	IsUUID,
	Max,
	Min,
	ValidateIf,
	ValidateNested,
} from "class-validator";
import { IsIsoDateString } from "@shared/validators/is-iso-date.validator";
import { NoSqlInjection } from "@shared/validators/no-sql-injection.validator";
import { IsSecureUUID, UUID_V4 } from "@shared/validators";
import { Trim } from "@shared/decorators/trim.decorator";

/* ------------------------------------------
 * Classification Result
 * ------------------------------------------ */
// biome-ignore format: true
export class CreateResultDto {
  @ApiProperty({ description: "Unique identifier for the classification result", example: "550e8400-e29b-41d4-a716-446655440000", format: "uuid", pattern: UUID_V4 })
  @Trim()
  @IsDefined({ message: "id is required" })
  @IsSecureUUID()
  id!: string;

  @ApiProperty({ description: "AI predicted class name" })
  @IsDefined()
  @IsString()
  @NoSqlInjection()
  aiClassName!: string;

  @ApiProperty({ description: "AI confidence (0-1)", example: 0.95 })
  @IsDefined()
  @IsNumber()
  @Min(0)
  @Max(1)
  aiConfidence!: number;

  @ApiProperty({ description: "AI raw confidences (object)", example: { class1: 0.95, class2: 0.05 } })
  @IsDefined()
  @IsObject()
  aiRawConfidencesJson!: Record<string, number>;

  @ApiPropertyOptional({ description: "Human feedback: is AI correct?" })
  @IsBoolean()
  @IsOptional()
  hfIsCorrect?: boolean;

  @ApiPropertyOptional({ description: "Human feedback: corrected class name" })
  @IsString()
  @NoSqlInjection()
  @IsOptional()
  hfCorrectedClassName?: string;

  @ApiPropertyOptional({ description: "Human feedback: observation" })
  @IsString()
  @NoSqlInjection()
  @IsOptional()
  hfObservation?: string;
}

/* ------------------------------------------
 * Photo (sin blob_*, requiere uploadItemId)
 * ------------------------------------------ */

export class CreatePhotoDto {
	@ApiProperty({
		description: "Photo ID (client-generated)",
		example: "550e8400-e29b-41d4-a716-446655440000",
		format: "uuid",
		pattern: UUID_V4,
	})
	@Trim()
	@IsDefined({ message: "id is required" })
	@IsSecureUUID()
	id!: string;

	@ApiProperty({
		enum: ["raw", "segmented", "cropped"],
		description: "Photo role",
	})
	@IsEnum(["raw", "segmented", "cropped"])
	role!: "raw" | "segmented" | "cropped";

	@ApiProperty({
		description: "Upload item ID (must exist)",
		example: "8b5f6a8f-2e0e-4d73-b8a8-4ae3a0e2beef",
	})
	@IsDefined()
	@IsUUID()
	uploadItemId!: string;
}

/* ------------------------------------------
 * Segment (sin blob_*, requiere uploadItemId)
 * ------------------------------------------ */

export class CreateSegmentDto {
	@ApiProperty({ description: "Segment ID (client-generated)" })
	@Trim()
	@IsDefined({ message: "id is required" })
	@IsSecureUUID()
	id!: string;

	@ApiProperty({ description: "Upload item ID (must exist)" })
	@Trim()
	@IsDefined({ message: "uploadItemId is required" })
	@IsSecureUUID()
	uploadItemId!: string;

	@ApiProperty({ description: "Best class name" })
	@IsDefined()
	@IsString()
	@NoSqlInjection()
	bestClassName!: string;

	@ApiProperty({ description: "Best confidence (0-1)", example: 0.98 })
	@IsDefined()
	@IsNumber()
	@Min(0)
	@Max(1)
	bestConfidence!: number;

	@ApiProperty({
		description: "Confidences object",
		example: { class1: 0.98, class2: 0.02 },
	})
	@IsDefined({ message: "confidencesJson is required" })
	@IsObject()
	confidencesJson!: Record<string, number>;
}

/* ------------------------------------------
 * Step
 * ------------------------------------------ */

export class CreateStepDto {
	@ApiProperty({
		description: "Step ID (client-generated)",
		example: "550e8400-e29b-41d4-a716-446655440000",
		format: "uuid",
		pattern: UUID_V4,
	})
	@Trim()
	@IsDefined({ message: "id is required" })
	@IsSecureUUID()
	id!: string;

	@ApiProperty({
		enum: ["external", "internal"],
		description: "Classification kind",
	})
	@IsEnum(["external", "internal"])
	kind!: "external" | "internal";

	@ApiProperty({ description: "Iteration index (0-3)", example: 0 })
	@Type(() => Number)
	@IsInt({ message: "iterationIndex must be an integer" })
	@Min(0, { message: "iterationIndex must be >= 0" })
	@Max(3, { message: "iterationIndex must be <= 3" })
	iterationIndex!: number;

	@ApiPropertyOptional({
		type: CreateResultDto,
		description: "Classification result",
	})
	@ValidateNested()
	@Type(() => CreateResultDto)
	@IsOptional()
	result?: CreateResultDto;

	@ApiPropertyOptional({ type: [CreatePhotoDto], description: "Photos" })
	@IsArray()
	@ArrayMinSize(1)
	@ValidateNested({ each: true })
	@Type(() => CreatePhotoDto)
	@IsOptional()
	photos?: CreatePhotoDto[];

	@ApiPropertyOptional({
		type: [CreateSegmentDto],
		description: "Classified segments",
	})
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => CreateSegmentDto)
	@IsOptional()
	segments?: CreateSegmentDto[];
}

/* ------------------------------------------
 * Evaluation (respetando NOT NULL de columnas)
 * ------------------------------------------ */

export class CreateEvaluationDto {
	@ApiProperty({
		description: "Evaluation ID (client-generated)",
		example: "123e4567-e89b-12d3-a456-426614174000",
	})
	@Trim()
	@IsDefined({ message: "id is required" })
	@IsSecureUUID()
	id!: string;

	@ApiProperty({
		enum: ["PLANT_ANALYSIS", "FIELD_EVENT"],
		description: "Type of evaluation",
	})
	@IsEnum(["PLANT_ANALYSIS", "FIELD_EVENT"])
	type!: "PLANT_ANALYSIS" | "FIELD_EVENT";

	@ApiProperty({
		description: "Creation timestamp (ISO 8601)",
		example: "2023-10-14T12:00:00Z",
	})
	@IsIsoDateString()
	creationTimestamp!: string;

	@ApiProperty({ description: "Upload session ID" })
	@Trim()
	@IsDefined({ message: "uploadSessionId is required" })
	@IsSecureUUID()
	uploadSessionId!: string;

	@ApiPropertyOptional({ description: "QR code" })
	@IsString()
	@NoSqlInjection()
	@IsOptional()
	qrCode?: string;

	// *** NOT NULL en BD → requeridos aquí ***
	@ApiProperty({ description: "Truck plate" })
	@IsDefined()
	@IsString()
	@NoSqlInjection()
	truckPlate!: string;

	@ApiProperty({ description: "Consecutive number" })
	@IsDefined()
	@IsString()
	@NoSqlInjection()
	consecutiveNumber!: string;

	// Condicionales de trazabilidad
	@ApiPropertyOptional({
		enum: ["own", "third-party"],
		description: "Provider kind (required for PLANT_ANALYSIS)",
	})
	@IsEnum(["own", "third-party"])
	@ValidateIf((o: CreateEvaluationDto) => o.type === "PLANT_ANALYSIS")
	@IsOptional()
	providerKind?: "own" | "third-party";

	@ApiPropertyOptional({
		description: "Provider ID (required for PLANT_ANALYSIS with third-party)",
	})
	@IsUUID()
	@ValidateIf(
		(o: CreateEvaluationDto) =>
			o.type === "PLANT_ANALYSIS" && o.providerKind === "third-party",
	)
	@IsOptional()
	providerId?: string;

	@ApiPropertyOptional({ description: "Sub-provider ID (optional)" })
	@IsUUID()
	@IsOptional()
	subProviderId?: string;

	@ApiPropertyOptional({
		description: "Program ID (FIELD_EVENT or PLANT_ANALYSIS with own)",
	})
	@Trim()
	@IsSecureUUID()
	@ValidateIf(
		(o: CreateEvaluationDto) =>
			o.type === "FIELD_EVENT" ||
			(o.type === "PLANT_ANALYSIS" && o.providerKind === "own"),
	)
	@IsOptional()
	programId?: string;

	@ApiPropertyOptional({ description: "Lot ID (required for FIELD_EVENT)" })
	@Trim()
	@IsSecureUUID()
	@ValidateIf((o: CreateEvaluationDto) => o.type === "FIELD_EVENT")
	@IsOptional()
	lotId?: string;

	@ApiPropertyOptional({ description: "Center ID (required for FIELD_EVENT)" })
	@Trim()
	@IsSecureUUID()
	@ValidateIf((o: CreateEvaluationDto) => o.type === "FIELD_EVENT")
	@IsOptional()
	centerId?: string;

	@ApiPropertyOptional({
		type: [String],
		description:
			"Lot IDs to associate with the evaluation (required when type=PLANT_ANALYSIS and providerKind=own). Ignored otherwise.",
		example: ["8a6a3c4f-1b2c-4f5a-b6d7-8e9f0a1b2c3d"],
		isArray: true,
	})
	@ValidateIf(
		(o: CreateEvaluationDto) =>
			o.type === "PLANT_ANALYSIS" && o.providerKind === "own",
	)
	@IsArray()
	@ArrayMinSize(1, {
		message: "lotIds must contain at least one lot when providerKind=own",
	})
	@ArrayUnique({ message: "lotIds must be unique" })
	@IsUUID("4", { each: true, message: "each lotId must be a valid UUID v4" })
	@IsOptional()
	lotIds?: string[];

	// *** NOT NULL en BD → requeridos aquí ***
	@ApiProperty({ enum: ["day", "night"], description: "Time of day" })
	@IsEnum(["day", "night"])
	deviceTimeOfDay!: "day" | "night";

	@ApiProperty({ description: "Device weather conditions" })
	@IsString()
	@NoSqlInjection()
	deviceWeather!: string;

	@ApiProperty({ description: "Device has internet connection" })
	@IsBoolean()
	deviceHasInternet!: boolean;

	@ApiProperty({ description: "Latitude (-90 to 90)", example: -12.046374 })
	@IsNumber()
	@Min(-90)
	@Max(90)
	geoLatitude!: number;

	@ApiProperty({ description: "Longitude (-180 to 180)", example: -77.042793 })
	@IsNumber()
	@Min(-180)
	@Max(180)
	geoLongitude!: number;

	@ApiProperty({
		description: "Harvest criteria (object)",
		example: { minSize: 10, maxSize: 20 },
	})
	@IsObject()
	harvestCriteriaJson!: Record<string, unknown>;

	@ApiPropertyOptional({ description: "Harvest observation" })
	@IsString()
	@NoSqlInjection()
	@IsOptional()
	harvestObservation?: string;

	@ApiPropertyOptional({ description: "Detection model ID" })
	@IsUUID()
	@IsOptional()
	modelDetectionId?: string;

	@ApiPropertyOptional({ description: "External classification model ID" })
	@IsUUID()
	@IsOptional()
	modelExternalId?: string;

	@ApiPropertyOptional({ description: "Internal classification model ID" })
	@IsUUID()
	@IsOptional()
	modelInternalId?: string;

	@ApiPropertyOptional({
		type: [CreateStepDto],
		description: "Classification steps",
	})
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => CreateStepDto)
	@IsOptional()
	steps?: CreateStepDto[];
}
