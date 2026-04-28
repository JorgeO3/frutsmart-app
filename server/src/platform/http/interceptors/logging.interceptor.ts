import {
	type CallHandler,
	type ExecutionContext,
	Injectable,
	type NestInterceptor,
} from "@nestjs/common";
import { Logger } from "nestjs-pino";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
	constructor(private readonly logger: Logger) {}

	intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
		const req = ctx.switchToHttp().getRequest();
		const { method, url } = req;
		const start = Date.now();

		return next.handle().pipe(
			tap({
				next: () => {
					const res = ctx.switchToHttp().getResponse();
					this.logger.log(
						{
							method,
							url,
							statusCode: res.statusCode,
							durationMs: Date.now() - start,
							requestId: req.requestId,
						},
						"request completed",
					);
				},
				error: (err) => {
					const res = ctx.switchToHttp().getResponse();
					this.logger.error(
						{
							method,
							url,
							statusCode: res?.statusCode,
							durationMs: Date.now() - start,
							requestId: req.requestId,
							err,
						},
						"request failed",
					);
				},
			}),
		);
	}
}
