import { Injectable } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import { ILogger } from "../../application/ports/logger.port";

/**
 * Adapter that implements ILogger using Pino logger from nestjs-pino.
 * Encapsulates Pino-specific logic and keeps the application layer independent.
 */
@Injectable()
export class PinoLoggerAdapter implements ILogger {
	constructor(private readonly logger: PinoLogger) {
		this.logger.setContext("UploadModule");
	}

	log(message: string, context?: Record<string, unknown>): void {
		this.logger.info(context, message);
	}

	debug(message: string, context?: Record<string, unknown>): void {
		this.logger.debug(context, message);
	}

	warn(message: string, context?: Record<string, unknown>): void {
		this.logger.warn(context, message);
	}

	error(
		message: string,
		trace?: string,
		context?: Record<string, unknown>,
	): void {
		const errorContext = trace ? { ...context, trace } : context;
		this.logger.error(errorContext, message);
	}
}
