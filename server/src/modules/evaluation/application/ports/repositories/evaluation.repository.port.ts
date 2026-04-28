import { Evaluation } from "../../../domain/entities/evaluation.entity";
import { UUID } from "../../../domain/types";

/**
 * Repository port for Evaluation aggregate.
 *
 * Defines the contract for persisting and retrieving evaluations.
 */
export const EVALUATION_REPOSITORY = "EvaluationRepository";

export interface IEvaluationRepository {
	/**
	 * Save an evaluation (create or update).
	 */
	save(entity: Evaluation): Promise<void>;

	/**
	 * Find an evaluation by ID.
	 */
	findById(id: UUID): Promise<Evaluation | null>;
}
