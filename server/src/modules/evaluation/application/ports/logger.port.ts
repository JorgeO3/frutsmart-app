/**
 * Port interface defining the contract for a logging service.
 *
 * @remarks
 * This abstraction decouples the application from specific logging implementations
 * (e.g., NestJS Logger, Pino, Winston), enabling flexible logging strategies
 * and easier testing through mock implementations.
 */
export const LOGGER = "Logger";

export interface ILogger {
	/**
	 * Logs a debug-level message with optional context.
	 *
	 * @param message - The message to log
	 * @param context - Optional contextual data for structured logging
	 */
	debug(message: string, context?: Record<string, unknown>): void;

	/**
	 * Logs an info-level message with optional context.
	 *
	 * @param message - The message to log
	 * @param context - Optional contextual data for structured logging
	 */
	log(message: string, context?: Record<string, unknown>): void;

	/**
	 * Logs a warning-level message with optional context.
	 *
	 * @param message - The message to log
	 * @param context - Optional contextual data for structured logging
	 */
	warn(message: string, context?: Record<string, unknown>): void;

	/**
	 * Logs an error-level message with optional stack trace and context.
	 *
	 * @param message - The error message to log
	 * @param trace - Optional stack trace for debugging
	 * @param context - Optional contextual data for structured logging
	 */
	error(
		message: string,
		trace?: string,
		context?: Record<string, unknown>,
	): void;
}
