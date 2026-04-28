import {
	type CanActivate,
	type ExecutionContext,
	Injectable,
	UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { IS_PUBLIC_KEY } from "@shared/decorators/public.decorator";

type ClientClaim = { typ: string; val: string };
type ClientPrincipal = {
	identityProvider: string;
	userId: string;
	userDetails?: string;
	claims: ClientClaim[];
};

declare module "fastify" {
	interface FastifyRequest {
		user?: {
			idp: string;
			sub: string;
			name?: string;
			roles: string[];
			raw: ClientPrincipal;
		};
	}
}

function makePrincipal(
	idp: string,
	sub: string,
	name: string | undefined,
	roles: string[],
): ClientPrincipal {
	return {
		identityProvider: idp,
		userId: sub,
		userDetails: name,
		claims: [
			{ typ: "roles", val: roles.join(",") }, // informativo
			{ typ: "name", val: name ?? "" },
			{ typ: "nameidentifier", val: sub },
		],
	};
}

@Injectable()
export class EasyAuthGuard implements CanActivate {
	constructor(private reflector: Reflector) {}

	canActivate(ctx: ExecutionContext): boolean {
		const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
			ctx.getHandler(),
			ctx.getClass(),
		]);
		if (isPublic) return true;

		// 0) Kill-switch para pruebas locales
		if (process.env.AUTH_DISABLED === "true") return true;

		const req = ctx.switchToHttp().getRequest();

		// 1) Dev header: x-dev-auth
		const devHeader = (req.headers["x-dev-auth"] as string | undefined)?.trim();
		const devSecret = process.env.DEV_AUTH_SECRET ?? "dev-secret";
		if (devHeader && devHeader === devSecret) {
			const raw = makePrincipal("dev", "dev-user", "Developer", ["dev"]);
			req.user = {
				idp: raw.identityProvider,
				sub: raw.userId,
				name: raw.userDetails,
				roles: ["dev"],
				raw,
			};
			return true;
		}

		// 2) Bearer fijo para pruebas
		const auth = req.headers.authorization as string | undefined;
		if (auth?.startsWith("Bearer ")) {
			const token = auth.substring("Bearer ".length).trim();
			const testBearer = process.env.TEST_BEARER_TOKEN ?? "test-bearer";
			if (token === testBearer) {
				const raw = makePrincipal("bearer", "bearer-user", "Bearer Tester", [
					"tester",
				]);
				req.user = {
					idp: raw.identityProvider,
					sub: raw.userId,
					name: raw.userDetails,
					roles: ["tester"],
					raw,
				};
				return true;
			}
		}

		// 3) Azure Easy Auth (tu lógica actual)
		const b64 = req.headers["x-ms-client-principal"] as string | undefined;
		if (b64) {
			let principal: ClientPrincipal;
			try {
				const json = Buffer.from(b64, "base64").toString("utf8");
				principal = JSON.parse(json);
			} catch {
				throw new UnauthorizedException("Invalid Easy Auth principal format");
			}

			const findClaim = (pred: (c: ClientClaim) => boolean) =>
				principal.claims.find(pred)?.val;

			const roles =
				principal.claims
					.filter((c) => /\/roles?$|^roles?$/i.test(c.typ))
					.map((c) => c.val)
					// si Azure envía una sola claim con CSV, parte en roles
					.flatMap((v) =>
						v
							.split(",")
							.map((s) => s.trim())
							.filter(Boolean),
					) ?? [];

			const sub =
				findClaim((c) => /nameidentifier$/i.test(c.typ)) ?? principal.userId;

			req.user = {
				idp: principal.identityProvider,
				sub,
				name:
					principal.userDetails ??
					findClaim((c) => /name$|preferred_username$/i.test(c.typ)),
				roles,
				raw: principal,
			};
			return true;
		}

		// Nada coincidió
		throw new UnauthorizedException("Missing Easy Auth principal");
	}
}
