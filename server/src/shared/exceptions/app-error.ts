export class AppError extends Error {
	readonly code: string;
	readonly details?: unknown;

	constructor(message: string, code = "APP_ERROR", details?: unknown) {
		super(message);
		this.name = "AppError";
		this.code = code;
		this.details = details;
	}
}
