import { NotFoundException } from "@nestjs/common";

export class SessionNotFoundError extends NotFoundException {
	constructor(sessionId: string) {
		super(`Session with ID ${sessionId} not found.`);
	}
}
