import { CreateEvaluationInput } from "../dto/create-evaluation/create-evaluation.input";
import { CreateEvaluationOutput } from "../dto/create-evaluation/create-evaluation.output";
import { Evaluation } from "../../domain/entities/evaluation.entity";

/**
 * Token for CreateEvaluationMapper injection
 */
export const CREATE_EVALUATION_MAPPER = Symbol("CREATE_EVALUATION_MAPPER");

/**
 * Port interface for CreateEvaluationMapper
 * Handles conversion between domain entities and application DTOs.
 */
export interface ICreateEvaluationMapper {
	/**
	 * Map input DTO to Evaluation domain aggregate (with finalization).
	 */
	toDomain(input: CreateEvaluationInput): Evaluation;

	/**
	 * Map Evaluation aggregate to output DTO (summary).
	 */
	toOutput(evaluation: Evaluation): CreateEvaluationOutput;
}
