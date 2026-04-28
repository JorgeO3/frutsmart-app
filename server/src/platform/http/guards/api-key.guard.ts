import {
	type CanActivate,
	type ExecutionContext,
	Injectable,
	UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import { IS_PUBLIC_KEY } from "@shared/decorators/public.decorator";

/**
 * Simple API-key guard:
 * - Lee un header configurable (por defecto: x-internal-secret).
 * - Compara con una clave en env (por defecto: INTERNAL_API_SECRET).
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
	private readonly headerName: string;
	private readonly secret: string;

	constructor(
		private readonly configService: ConfigService,
		private readonly reflector: Reflector,
	) {
		// Use security config section (added via security.config.ts)
		this.headerName =
			this.configService.get<string>("security.apiKeyHeader") ||
			"x-internal-secret";
		this.secret =
			this.configService.get<string>("security.internalApiSecret") || "";
	}

	canActivate(ctx: ExecutionContext): boolean {
		const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
			ctx.getHandler(),
			ctx.getClass(),
		]);
		if (isPublic) return true;

		if (!this.secret) return true; // si no hay secreto configurado, no bloquear
		const req = ctx.switchToHttp().getRequest();
		const provided = (
			req.headers[this.headerName] as string | undefined
		)?.trim();
		if (!provided || provided !== this.secret) {
			throw new UnauthorizedException("Invalid or missing API key");
		}
		return true;
	}
}
