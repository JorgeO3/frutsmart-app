/**
 * Domain error thrown when an argument is invalid according to business rules.
 */
export class ArgumentInvalidError extends Error {
	constructor(message: string) {
		super(`Invalid argument: ${message}`);
		this.name = "ArgumentInvalidError";
		Object.setPrototypeOf(this, ArgumentInvalidError.prototype);
	}
}
