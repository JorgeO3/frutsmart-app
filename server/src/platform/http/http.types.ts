/**
 * Platform HTTP Types
 *
 * Re-exports all HTTP-related infrastructure components (filters, guards, interceptors, pipes)
 * for use in the Platform Module.
 */

// Filters
export { AllExceptionsFilter } from "./filters/all-exceptions.filter";
export { ValidationExceptionFilter } from "./filters/validation-exception.filter";

// Guards
export { ApiKeyGuard } from "./guards/api-key.guard";
export { EasyAuthGuard } from "./guards/easy-auth.guard";
export { RolesGuard } from "./guards/roles.guard";
export { AppThrottlerGuard } from "./guards/throttler.guard";

// Interceptors
export { CorrelationIdInterceptor } from "./interceptors/correlation-id.interceptor";
export { LoggingInterceptor } from "./interceptors/logging.interceptor";
export { TimeoutInterceptor } from "./interceptors/timeout.interceptor";

// Pipes
export { PaginationPipe } from "./pipes/pagination.pipe";
export { ParseUuidArrayPipe } from "./pipes/parse-uuid-array.pipe";
export { ToBooleanPipe } from "./pipes/to-boolean.pipe";
export { TrimPipe } from "./pipes/trim.pipe";
