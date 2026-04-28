/**
 * Domain error thrown when traceability business rules are violated.
 */
export class TraceabilityViolationError extends Error {
	constructor(message: string) {
		super(`Traceability violation: ${message}`);
		this.name = "TraceabilityViolationError";
		Object.setPrototypeOf(this, TraceabilityViolationError.prototype);
	}
}
