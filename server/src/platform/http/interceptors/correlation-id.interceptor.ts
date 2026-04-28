import {
	type CallHandler,
	type ExecutionContext,
	Injectable,
	type NestInterceptor,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import { v4 as uuid } from "uuid";

import {
	HDR_CF_RAY,
	HDR_REQUEST_ID,
	HDR_TRACEPARENT,
} from "../../logging/logging.constants";

declare module "fastify" {
	interface FastifyRequest {
		requestId?: string;
	}
}

@Injectable()
export class CorrelationIdInterceptor implements NestInterceptor {
	intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
		const req = ctx.switchToHttp().getRequest();
		const res = ctx.switchToHttp().getResponse();

		const fromTrace = (
			req.headers[HDR_TRACEPARENT] as string | undefined
		)?.split("-")[1];
		const fromCfRay = req.headers[HDR_CF_RAY] as string | undefined;
		const fromReqId = req.headers[HDR_REQUEST_ID] as string | undefined;

		const rid = fromTrace ?? fromCfRay ?? fromReqId ?? uuid();
		req.requestId = rid;
		res.header(HDR_REQUEST_ID, rid);

		const t0 = Date.now();
		return next
			.handle()
			.pipe(tap(() => res.header("x-response-time", `${Date.now() - t0}ms`)));
	}
}
