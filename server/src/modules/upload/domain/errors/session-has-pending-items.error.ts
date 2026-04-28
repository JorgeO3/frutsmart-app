import { UUID } from "../types";

/**
 * Error lanzado cuando se intenta completar una sesión, pero uno o más de sus
 * ítems no han llegado a un estado terminal válido (ej: 'VERIFIED').
 */
export class SessionHasPendingItemsError extends Error {
	constructor(sessionId: UUID) {
		super(
			`Cannot complete session with ID '${sessionId}'. Reason: One or more items are not in a final 'VERIFIED' state.`,
		);
		this.name = this.constructor.name;
	}
}
