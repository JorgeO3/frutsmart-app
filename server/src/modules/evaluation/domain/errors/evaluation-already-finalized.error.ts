import { UUID } from "../types";

/**
 * Domain error thrown when attempting to modify an evaluation that has already been finalized.
 */
export class EvaluationAlreadyFinalizedError extends Error {
	constructor(evaluationId: UUID) {
		super(
			`Evaluation ${evaluationId} is already finalized and cannot be modified`,
		);
		this.name = "EvaluationAlreadyFinalizedError";
		Object.setPrototypeOf(this, EvaluationAlreadyFinalizedError.prototype);
	}
}
