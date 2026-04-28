import { NotFoundException } from "@nestjs/common";

export class ItemNotFoundError extends NotFoundException {
	constructor(blobName: string, sessionId: string) {
		super(
			`Item with blobName "${blobName}" not found in session ${sessionId}.`,
		);
	}
}
