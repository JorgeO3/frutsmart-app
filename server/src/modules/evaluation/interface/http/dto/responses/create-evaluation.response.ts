import { ApiProperty } from "@nestjs/swagger";

/**
 * Nested DTO - Declared first to avoid forward reference errors
 */
export class StepSummaryDto {
	@ApiProperty({
		enum: ["external", "internal"],
		description: "Classification kind",
	})
	kind!: string;

	@ApiProperty({ description: "Iteration index (0-3)" })
	iterationIndex!: number;

	@ApiProperty({ description: "Has result?" })
	hasResult!: boolean;

	@ApiProperty({ description: "Number of photos" })
	photoCount!: number;

	@ApiProperty({ description: "Number of segments" })
	segmentCount!: number;
}

/**
 * Response DTO for creating an evaluation (HTTP layer).
 */
export class CreateEvaluationResponse {
	@ApiProperty({ description: "Evaluation ID" })
	id!: string;

	@ApiProperty({
		enum: ["PLANT_ANALYSIS", "FIELD_EVENT"],
		description: "Type of evaluation",
	})
	type!: string;

	@ApiProperty({ description: "Is the evaluation finalized?" })
	isFinalized!: boolean;

	@ApiProperty({ description: "Creation date" })
	createdAt!: Date;

	@ApiProperty({ description: "Total number of steps" })
	totalSteps!: number;

	@ApiProperty({ description: "Total number of photos" })
	totalPhotos!: number;

	@ApiProperty({ description: "Total number of segments" })
	totalSegments!: number;

	@ApiProperty({ type: [StepSummaryDto], description: "Summary of steps" })
	stepsSummary!: StepSummaryDto[];
}
