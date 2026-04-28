/**
 * Domain error thrown when iteration index is outside the valid range [0..3].
 */
export class InvalidIterationIndexError extends Error {
	constructor(iterationIndex: number) {
		super(
			`Invalid iteration index: ${iterationIndex}. Must be between 0 and 3`,
		);
		this.name = "InvalidIterationIndexError";
		Object.setPrototypeOf(this, InvalidIterationIndexError.prototype);
	}
}
