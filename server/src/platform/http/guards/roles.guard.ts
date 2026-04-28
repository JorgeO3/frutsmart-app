import {
	type CanActivate,
	type ExecutionContext,
	ForbiddenException,
	Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY } from "@shared/decorators/roles.decorator";
import { IS_PUBLIC_KEY } from "@shared/decorators/public.decorator";

@Injectable()
export class RolesGuard implements CanActivate {
	constructor(private readonly reflector: Reflector) {}

	canActivate(ctx: ExecutionContext): boolean {
		const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
			ctx.getHandler(),
			ctx.getClass(),
		]);
		if (isPublic) return true;

		const required =
			this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
				ctx.getHandler(),
				ctx.getClass(),
			]) ?? [];

		if (required.length === 0) return true;

		const { user } = ctx.switchToHttp().getRequest();
		const roles: string[] = user?.roles ?? [];
		const ok = required.some((r) => roles.includes(r));
		if (!ok) throw new ForbiddenException("Insufficient role");
		return true;
	}
}
