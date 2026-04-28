import { UUID } from "../types";

/**
 * Error lanzado cuando se intenta completar una sesión que no contiene
 * ningún ítem de subida.
 */
export class SessionEmptyError extends Error {
	constructor(sessionId: UUID) {
		super(
			`Cannot complete session with ID '${sessionId}'. Reason: The session is empty and has no items.`,
		);
		this.name = this.constructor.name;
	}
}
