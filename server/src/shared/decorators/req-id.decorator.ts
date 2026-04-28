import { createParamDecorator, type ExecutionContext } from "@nestjs/common";

export const ReqId = createParamDecorator(
	(_data: unknown, ctx: ExecutionContext) => {
		const req = ctx.switchToHttp().getRequest();
		return req.requestId ?? null;
	},
);
