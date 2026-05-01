import { Module } from "@nestjs/common";
import { LoggerModule } from "nestjs-pino";
import { IncomingMessage, ServerResponse } from "node:http";
import { GenReqId, Options as PinoHttpOptions, ReqId } from "pino-http";
import { randomUUID } from "node:crypto";

/* =========================
   Constantes
   ========================= */

const TRACEPARENT_HEADER = "traceparent";
const CF_RAY_HEADER = "cf-ray";
const REQUEST_ID_HEADER = "x-request-id";

const TRACEPARENT_TRACE_ID_INDEX = 1;
const AUTHORIZATION_HEADER = "authorization";
const COOKIE_HEADER = "cookie";

/* =========================
   Type Guards
   ========================= */

const isString = (value: unknown): value is string => typeof value === "string";
const isNumber = (value: unknown): value is number => typeof value === "number";
const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.length > 0 && isString(value[0]);
const hasId = (obj: unknown): obj is { id?: ReqId } =>
  typeof obj === "object" && obj !== null;

/* =========================
   Utilidades
   ========================= */

const pickHeaderValue = (
  headers: IncomingMessage["headers"],
  name: string,
): string | undefined => {
  const value = headers[name.toLowerCase()];
  if (isStringArray(value)) return value[0];
  return isString(value) ? value : undefined;
};

const stringifyId = (id: ReqId | undefined): string | undefined => {
  if (id == null) return undefined;
  if (isString(id)) return id;
  if (isNumber(id)) return String(id);
  try {
    return JSON.stringify(id);
  } catch {
    return String(id);
  }
};

const extractTraceIdFromTraceparent = (traceparent: string): string => {
  const parts = traceparent.split("-");
  return parts[TRACEPARENT_TRACE_ID_INDEX] ?? "";
};

const extractFrameworkId = (req: IncomingMessage): ReqId | undefined =>
  hasId(req) ? req.id : undefined;

/* =========================
   Request ID Generation
   ========================= */

const genReqId: GenReqId<IncomingMessage, ServerResponse<IncomingMessage>> = (
  req,
) => {
  const traceparent = pickHeaderValue(req.headers, TRACEPARENT_HEADER);
  if (traceparent) {
    const traceId = extractTraceIdFromTraceparent(traceparent);
    if (traceId) return traceId;
  }
  const cfRay = pickHeaderValue(req.headers, CF_RAY_HEADER);
  if (cfRay) return cfRay;

  const headerRequestId = pickHeaderValue(req.headers, REQUEST_ID_HEADER);
  if (headerRequestId) return headerRequestId;

  const frameworkId = extractFrameworkId(req);
  const stringId = stringifyId(frameworkId);
  if (stringId) return stringId;

  return randomUUID();
};

/* =========================
   Serializers
   ========================= */

const serializeRequest = (req: IncomingMessage) => {
  const frameworkId = extractFrameworkId(req);
  const id = stringifyId(frameworkId) ?? "";
  return { id, method: req.method, url: req.url };
};

const serializeResponse = (res: ServerResponse<IncomingMessage>) => ({
  statusCode: res.statusCode,
});

/* =========================
   Pino Configuration
   ========================= */

const isProd = process.env.BACKEND_NODE_ENV === "production";

const transport = isProd
  ? undefined
  : {
    target: "pino-pretty",
    options: { singleLine: true, colorize: true },
  };

// Asegura mutabilidad (string[]) en lugar de readonly tuple
const redactPaths: string[] = [
  `req.headers.${AUTHORIZATION_HEADER}`,
  `req.headers.${COOKIE_HEADER}`,
];

const pinoHttpOptions: PinoHttpOptions<
  IncomingMessage,
  ServerResponse<IncomingMessage>
> = {
  genReqId,
  transport,
  serializers: {
    req: serializeRequest,
    res: serializeResponse,
  },
  autoLogging: true,
  redact: {
    paths: redactPaths, // <- ahora es string[] mutable
    remove: true,
  },
};

/* =========================
   Module
   ========================= */

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: pinoHttpOptions,
    }),
  ],
  exports: [LoggerModule],
})
export class PinoLoggerModule { }
