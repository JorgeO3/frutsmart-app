import {
	type ArgumentsHost,
	BadRequestException,
	Catch,
	type ExceptionFilter,
} from "@nestjs/common";

type ValidationError = string | { message: string; [key: string]: unknown };

@Catch(BadRequestException)
export class ValidationExceptionFilter implements ExceptionFilter {
	catch(exception: BadRequestException, host: ArgumentsHost) {
		const ctx = host.switchToHttp();
		const req = ctx.getRequest();
		const res = ctx.getResponse();
		const resp = exception.getResponse() as Record<string, unknown>;

		const errors = Array.isArray(resp?.message)
			? resp.message
			: [resp?.message ?? "Validation error"];
		const formatted = errors.map((e: ValidationError) =>
			typeof e === "string" ? { message: e } : e,
		);

		res.status(400).send({
			status: 400,
			code: "VALIDATION_ERROR",
			message: "Request validation failed",
			errors: formatted,
			traceId: req.requestId,
			timestamp: new Date().toISOString(),
			path: req.url,
			method: req.method,
		});
	}
}
