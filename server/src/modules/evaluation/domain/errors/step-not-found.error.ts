import { UUID } from "../types";

/**
 * Domain error thrown when a classification step is not found.
 */
export class StepNotFoundError extends Error {
	constructor(stepId: UUID) {
		super(`Classification step ${stepId} not found`);
		this.name = "StepNotFoundError";
		Object.setPrototypeOf(this, StepNotFoundError.prototype);
	}
}
