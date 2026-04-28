import { AppError } from "./app-error";

export class NotFoundError extends AppError {
	constructor(message = "Not found", details?: unknown) {
		super(message, "NOT_FOUND", details);
		this.name = "NotFoundError";
	}
}
