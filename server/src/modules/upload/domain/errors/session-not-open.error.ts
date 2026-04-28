import { UUID } from "../types";

/**
 * Error lanzado cuando se intenta mutar una sesión (ej: añadir un ítem)
 * que ya no está en estado 'OPEN'.
 */
export class SessionNotOpenError extends Error {
	constructor(sessionId: UUID) {
		super(
			`Operation failed: Session with ID '${sessionId}' is not in 'OPEN' state.`,
		);
		this.name = this.constructor.name;
	}
}
