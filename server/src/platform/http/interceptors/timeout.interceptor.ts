import {
	type CallHandler,
	type ExecutionContext,
	Injectable,
	type NestInterceptor,
	RequestTimeoutException,
} from "@nestjs/common";
import {
	type Observable,
	TimeoutError,
	catchError,
	throwError,
	timeout,
} from "rxjs";

@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
	constructor(private readonly ms = 15000) {}

	intercept(_: ExecutionContext, next: CallHandler): Observable<unknown> {
		return next.handle().pipe(
			timeout(this.ms),
			catchError((err) => {
				if (err instanceof TimeoutError) {
					return throwError(() => new RequestTimeoutException());
				}
				return throwError(() => err);
			}),
		);
	}
}
