import {
	type ArgumentsHost,
	Catch,
	type ExceptionFilter,
	HttpException,
	HttpStatus,
	Logger,
} from "@nestjs/common";
import { FastifyReply, FastifyRequest } from "fastify";
import { randomUUID as nodeRandomUUID } from "node:crypto";

/* =========================
   Tipos
   ========================= */

type HeaderValue = string | number;
type HeadersMap = Readonly<Record<string, HeaderValue>>;

type NormalizedError = Readonly<{
	status: number;
	code: string;
	message: string;
	details?: unknown;
	headers?: HeadersMap;
}>;

type ErrorPayload = Readonly<{
	status: number;
	code: string;
	message: string;
	traceId?: string;
	timestamp: string;
	path?: string;
	method?: string;
	details?: unknown;
	stack?: string;
}>;

interface FastifyErrorShape {
	code?: string;
	statusCode?: number;
	message?: string;
	name?: string;
	headers?: unknown;
	validation?: unknown;
	after?: string | number;
}

type NormalizeHandler = (exc: unknown) => NormalizedError | undefined;

/* =========================
   Constantes
   ========================= */

const HTTP_STATUS_CODES = {
	400: "BAD_REQUEST",
	401: "UNAUTHORIZED",
	403: "FORBIDDEN",
	404: "NOT_FOUND",
	405: "METHOD_NOT_ALLOWED",
	409: "CONFLICT",
	413: "PAYLOAD_TOO_LARGE",
	415: "UNSUPPORTED_MEDIA_TYPE",
	422: "UNPROCESSABLE_ENTITY",
	429: "TOO_MANY_REQUESTS",
	500: "INTERNAL_ERROR",
	502: "BAD_GATEWAY",
	503: "SERVICE_UNAVAILABLE",
} as const;

const FASTIFY_ERRORS = {
	FST_ERR_CTP_BODY_TOO_LARGE: {
		status: HttpStatus.PAYLOAD_TOO_LARGE,
		code: "PAYLOAD_TOO_LARGE",
		message: "Payload too large",
	},
	FST_ERR_RATE_LIMIT_EXCEEDED: {
		status: HttpStatus.TOO_MANY_REQUESTS,
		code: "RATE_LIMITED",
		message: "Too many requests, please try again later.",
	},
	FST_ERR_CTP_INVALID_JSON: {
		status: HttpStatus.BAD_REQUEST,
		code: "INVALID_JSON",
		message: "Malformed JSON in request body",
	},
} as const;

const VALIDATION_MARKERS = [
	"validation",
	"is not iterable",
	"cannot use 'in' operator",
	"for each",
	"foreach",
	"cannot read properties of undefined",
] as const;

const VALIDATION_PATTERNS = [
	/class-validator/i,
	/validation\.pipe/i,
	/router-execution-context/i,
] as const;

const SAFE_HEADERS = new Set(["content-type", "x-request-id"]);
const RETRY_AFTER_HEADERS = ["Retry-After", "retry-after"] as const;
const DEFAULT_ERROR_MESSAGE = "Internal server error";
const INTERNAL_SERVER_ERROR_MESSAGE = "Internal server error";

/* =========================
   Type Guards
   ========================= */

const isObject = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null;

const hasStringProp = <T extends string>(
	obj: unknown,
	prop: T,
): obj is Record<T, string> => isObject(obj) && typeof obj[prop] === "string";

const hasNumberProp = <T extends string>(
	obj: unknown,
	prop: T,
): obj is Record<T, number> => isObject(obj) && typeof obj[prop] === "number";

const isHeadersMap = (value: unknown): value is HeadersMap => {
	if (!isObject(value)) return false;
	return Object.values(value).every(
		(v) => typeof v === "string" || typeof v === "number",
	);
};

const isFastifyErrorShape = (e: unknown): e is FastifyErrorShape => {
	if (!isObject(e)) return false;

	// Check if the object has at least one of the key properties
	const hasCode = hasStringProp(e, "code");
	const hasStatusCode = hasNumberProp(e, "statusCode");
	const hasMessage = hasStringProp(e, "message");
	const hasName = hasStringProp(e, "name");

	if (!hasCode && !hasStatusCode && !hasMessage && !hasName) return false;

	// If headers are present, ensure they are a valid HeadersMap
	if ("headers" in e && !isHeadersMap(e.headers)) return false;

	return true;
};

const isJsError = (
	exc: unknown,
): exc is SyntaxError | TypeError | ReferenceError =>
	exc instanceof SyntaxError ||
	exc instanceof TypeError ||
	exc instanceof ReferenceError;

const isNonEmptyStringArray = (value: unknown): value is readonly string[] =>
	Array.isArray(value) &&
	value.length > 0 &&
	value.every((v) => typeof v === "string");

/* =========================
   Utilidades
   ========================= */

const serializeJson = (value: unknown): string | undefined => {
	try {
		return JSON.stringify(value);
	} catch {
		return undefined;
	}
};

const extractStatusText = (status: number): string | undefined => {
	return (
		HTTP_STATUS_CODES[status as keyof typeof HTTP_STATUS_CODES] ??
		`HTTP_${status}`
	);
};

/* =========================
   Filtro
   ========================= */

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
	private readonly logger = new Logger(AllExceptionsFilter.name);
	private readonly isProd = process.env.NODE_ENV === "production";

	catch(exception: unknown, host: ArgumentsHost): void {
		const ctx = host.switchToHttp();
		const req = ctx.getRequest<FastifyRequest>();
		const res = ctx.getResponse<FastifyReply>();

		const traceId = this.extractTraceId(req);
		let normalized = this.normalize(exception);

		if (this.isProd && normalized.status >= 500) {
			normalized = {
				...normalized,
				message: INTERNAL_SERVER_ERROR_MESSAGE,
				details: undefined,
			};
		}

		if (this.isResponseSent(res)) {
			this.log(normalized, exception, req);
			return;
		}

		try {
			this.sendResponse(res, normalized, traceId, req);
			this.log(normalized, exception, req);
		} catch (writeErr) {
			this.sendFallbackError(res, traceId, req, writeErr);
		}
	}

	/* ================
	     Extracción de datos
	     ================ */

	private extractTraceId(req?: FastifyRequest): string {
		const fromHeader =
			(req?.headers?.["x-request-id"] as string | undefined) ??
			(req?.headers?.["X-Request-Id"] as string | undefined);

		return (
			(typeof req?.id === "string" ? req.id : undefined) ??
			fromHeader ??
			nodeRandomUUID()
		);
	}

	private extractHttpExceptionMessage(resp: unknown, fallback: string): string {
		if (typeof resp === "string") {
			return resp;
		}

		if (!isObject(resp)) {
			return fallback;
		}

		const messageArray = resp.message;
		if (isNonEmptyStringArray(messageArray)) {
			return messageArray.join("; ");
		}

		if (typeof resp.message === "string" && resp.message) {
			return resp.message;
		}

		if (typeof resp.error === "string" && resp.error) {
			return resp.error;
		}

		return fallback;
	}

	private extractHttpExceptionCode(resp: unknown): string | undefined {
		return isObject(resp) && typeof resp.code === "string"
			? resp.code
			: undefined;
	}

	private extractHttpExceptionDetails(resp: unknown): unknown {
		return isObject(resp) && !Array.isArray(resp) ? { ...resp } : undefined;
	}

	private extractRetryAfter(headers?: HeadersMap): HeaderValue | undefined {
		if (!headers) return undefined;

		for (const key of RETRY_AFTER_HEADERS) {
			if (key in headers) {
				return headers[key];
			}
		}

		return undefined;
	}

	private extractFallbackMessage(exc: unknown): string {
		if (typeof exc === "string") {
			return exc;
		}

		if (isObject(exc) && typeof exc.message === "string") {
			return exc.message;
		}

		return DEFAULT_ERROR_MESSAGE;
	}

	/* ================
	     Normalización
	     ================ */

	private normalize(exc: unknown): NormalizedError {
		const handlers: ReadonlyArray<NormalizeHandler> = [
			(e) => this.handleFastifyByCode(e),
			(e) => this.handleFastifyByStatusCode(e),
			(e) => this.handleNestHttpException(e),
			(e) => this.handleValidationError(e),
			(e) => this.handleJsError(e),
		];

		for (const handler of handlers) {
			const result = handler(exc);
			if (result) return result;
		}

		return this.handleFallback(exc);
	}

	private handleFastifyByCode(exc: unknown): NormalizedError | undefined {
		if (!isFastifyErrorShape(exc) || !exc.code) {
			return undefined;
		}

		const base = FASTIFY_ERRORS[exc.code as keyof typeof FASTIFY_ERRORS];
		if (!base) {
			return undefined;
		}

		const headers = isHeadersMap(exc.headers) ? exc.headers : undefined;

		return {
			...base,
			headers,
			details: exc.validation,
		};
	}

	private handleFastifyByStatusCode(exc: unknown): NormalizedError | undefined {
		if (!isFastifyErrorShape(exc) || typeof exc.statusCode !== "number") {
			return undefined;
		}

		const status = exc.statusCode;
		const code = exc.code ?? exc.name;
		const message = exc.message || "Error";
		const headers = isHeadersMap(exc.headers) ? exc.headers : undefined;

		return {
			status,
			code: this.getErrorCode(status, code),
			message,
			headers,
			details: exc.validation,
		};
	}

	private handleNestHttpException(exc: unknown): NormalizedError | undefined {
		if (!(exc instanceof HttpException)) {
			return undefined;
		}

		const status = exc.getStatus();
		const resp = exc.getResponse();
		const message = this.extractHttpExceptionMessage(resp, exc.message);
		const code = this.extractHttpExceptionCode(resp);
		const details = this.extractHttpExceptionDetails(resp);

		return {
			status,
			code: this.getErrorCode(status, code),
			message,
			details,
		};
	}

	private handleValidationError(exc: unknown): NormalizedError | undefined {
		if (!isObject(exc)) {
			return undefined;
		}

		const msgLower =
			typeof exc.message === "string" ? exc.message.toLowerCase() : "";
		const isValidationByMessage = VALIDATION_MARKERS.some((marker) =>
			msgLower.includes(marker),
		);

		if (isValidationByMessage) {
			return this.buildValidationError(exc);
		}

		const stack = typeof exc.stack === "string" ? exc.stack : "";
		const isValidationByStack = VALIDATION_PATTERNS.some((pattern) =>
			pattern.test(stack),
		);

		if (isValidationByStack) {
			return this.buildValidationError(exc);
		}

		return undefined;
	}

	private buildValidationError(exc: Record<string, unknown>): NormalizedError {
		const details = this.isProd
			? undefined
			: { error: typeof exc.message === "string" ? exc.message : undefined };

		return {
			status: HttpStatus.BAD_REQUEST,
			code: "BAD_REQUEST",
			message: "Invalid request data",
			details,
		};
	}

	private handleJsError(exc: unknown): NormalizedError | undefined {
		if (!isJsError(exc)) {
			return undefined;
		}

		return {
			status: HttpStatus.INTERNAL_SERVER_ERROR,
			code: "INTERNAL_ERROR",
			message: String(exc.message ?? exc),
		};
	}

	private handleFallback(exc: unknown): NormalizedError {
		const message = this.extractFallbackMessage(exc);

		return {
			status: HttpStatus.INTERNAL_SERVER_ERROR,
			code: "INTERNAL_ERROR",
			message,
		};
	}

	/* ================
	     Respuesta HTTP
	     ================ */

	private isResponseSent(res: FastifyReply): boolean {
		return res.sent || res.raw.headersSent;
	}

	private getErrorCode(status: number, provided?: string): string {
		if (provided) {
			return provided;
		}

		return extractStatusText(status) || DEFAULT_ERROR_MESSAGE;
	}

	private sendResponse(
		res: FastifyReply,
		normalized: NormalizedError,
		traceId: string,
		req?: FastifyRequest,
	): void {
		this.setStandardHeaders(res, traceId);
		this.setCustomHeaders(res, normalized.headers);
		this.setRetryAfterHeader(res, normalized);

		const payload = this.buildPayload(normalized, traceId, req);
		res.status(normalized.status).send(payload);
	}

	private setStandardHeaders(res: FastifyReply, traceId: string): void {
		res.header("x-request-id", traceId);
		res.header("content-type", "application/json; charset=utf-8");
	}

	private setCustomHeaders(res: FastifyReply, headers?: HeadersMap): void {
		if (!headers) {
			return;
		}

		for (const [key, value] of Object.entries(headers)) {
			const isBlocked = SAFE_HEADERS.has(key.toLowerCase());
			if (!isBlocked) {
				res.header(key, value);
			}
		}
	}

	private setRetryAfterHeader(
		res: FastifyReply,
		normalized: NormalizedError,
	): void {
		if (normalized.status !== HttpStatus.TOO_MANY_REQUESTS) {
			return;
		}

		const retryAfter = this.extractRetryAfter(normalized.headers);
		if (retryAfter !== undefined) {
			res.header("Retry-After", String(retryAfter));
		}
	}

	private buildPayload(
		normalized: NormalizedError,
		traceId: string,
		req?: FastifyRequest,
	): ErrorPayload {
		const base = {
			status: normalized.status,
			code: normalized.code,
			message: normalized.message,
			details: normalized.details,
			traceId,
			timestamp: new Date().toISOString(),
			path: req?.url,
			method: req?.method,
		};

		if (this.isProd) {
			return base;
		}

		const stack = this.captureStack();
		return { ...base, stack };
	}

	private captureStack(): string | undefined {
		try {
			return new Error().stack;
		} catch {
			return undefined;
		}
	}

	private sendFallbackError(
		res: FastifyReply,
		traceId: string,
		req?: FastifyRequest,
		err?: unknown,
	): void {
		const message = this.isProd ? INTERNAL_SERVER_ERROR_MESSAGE : String(err);

		const payload: ErrorPayload = {
			status: HttpStatus.INTERNAL_SERVER_ERROR,
			code: "INTERNAL_ERROR",
			message,
			traceId,
			timestamp: new Date().toISOString(),
			path: req?.url,
			method: req?.method,
		};

		res.status(HttpStatus.INTERNAL_SERVER_ERROR).send(payload);
	}

	/* ================
	     Logging
	     ================ */

	private log(
		normalized: NormalizedError,
		exception: unknown,
		req?: FastifyRequest,
	): void {
		const prefix = this.buildLogPrefix(normalized, req);

		if (normalized.status >= 500) {
			this.logError(prefix, exception);
			return;
		}

		if (normalized.status >= 400) {
			this.logWarning(prefix, normalized.details);
			return;
		}

		this.logger.log(prefix);
	}

	private buildLogPrefix(
		normalized: NormalizedError,
		req?: FastifyRequest,
	): string {
		const method = req?.method ?? "?";
		const path = req?.url ?? "?";

		return `${method} ${path} -> ${normalized.status} [${normalized.code}] ${normalized.message}`;
	}

	private logError(message: string, exception: unknown): void {
		if (this.isProd || !(exception instanceof Error)) {
			this.logger.error(message);
			return;
		}

		this.logger.error(message, exception.stack);
	}

	private logWarning(message: string, details: unknown): void {
		const serialized = serializeJson(details);

		if (serialized) {
			this.logger.warn(`${message} - ${serialized}`);
			return;
		}

		this.logger.warn(message);
	}
}
