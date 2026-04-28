// src/platform/http/plugins/auto-405.plugin.ts
import type {
	FastifyInstance,
	FastifyReply,
	FastifyRequest,
	RouteOptions,
} from "fastify";

// ============================================================================
// Types & Constants
// ============================================================================

type Method = Uppercase<string>;
type MethodsSet = Set<Method>;
type ConstraintBucket = Map<string, MethodsSet>;
type RouteIndexMap = Map<string, ConstraintBucket>;

interface RouteConstraints {
	host?: string;
	version?: string;
	[key: string]: unknown;
}

interface RouteWithConstraints extends RouteOptions {
	constraints?: RouteConstraints;
}

interface RouteWithConfig extends RouteOptions {}
interface FastifyRequestTyped extends FastifyRequest {}

interface FastifyReplyTyped extends FastifyReply {
	callNotFound: () => void;
}

interface ErrorResponse {
	statusCode: number;
	error: string;
	message: string;
}

const kSeen = Symbol("auto405-seen");

// ============================================================================
// Helpers
// ============================================================================

function extractConstraints(route: RouteOptions): RouteConstraints {
	const routeWithConstraints = route as RouteWithConstraints;
	return routeWithConstraints.constraints ?? {};
}

function keyConstraints(route: RouteOptions): string {
	const constraints = extractConstraints(route);
	const { host, version, ...rest } = constraints;
	return JSON.stringify({ host, version, ...rest });
}

function normalizeMethod(method: string): Method {
	return method.toUpperCase() as Method;
}

function extractHost(req: FastifyRequest): string | undefined {
	const typedReq = req as FastifyRequestTyped;
	const authority = typedReq.headers[":authority"];
	const host = typedReq.headers.host;

	const authorityStr = Array.isArray(authority) ? authority[0] : authority;
	const hostStr = Array.isArray(host) ? host[0] : host;

	return authorityStr ?? hostStr ?? undefined;
}

function extractVersion(req: FastifyRequest): string | undefined {
	const typedReq = req as FastifyRequestTyped;
	const version = typedReq.headers["accept-version"];
	return Array.isArray(version) ? version[0] : (version ?? undefined);
}

function createPreferKey(
	host: string | undefined,
	version: string | undefined,
): string {
	return JSON.stringify({ host, version });
}

function extractUrl(req: FastifyRequest): string {
	const typedReq = req as FastifyRequestTyped;
	return typedReq.raw.url ?? req.url;
}

// ============================================================================
// Index Manager
// ============================================================================

class RouteIndex {
	private readonly index: RouteIndexMap = new Map();

	add(route: RouteOptions): void {
		const url = route.url;
		const methods = this.extractMethods(route);
		const bucketKey = keyConstraints(route);

		const bucket = this.getOrCreateBucket(url);
		const methodSet = this.getOrCreateMethodSet(bucket, bucketKey);

		for (const method of methods) {
			methodSet.add(normalizeMethod(method));
		}
	}

	getAllowedMethods(url: string, req: FastifyRequest): string | undefined {
		const buckets = this.index.get(url);
		if (!buckets) {
			return undefined;
		}

		const candidates = this.findCandidateMethods(buckets, req);
		const allowedMethods = this.unionMethods(candidates);

		if (allowedMethods.size === 0) {
			return undefined;
		}

		return this.formatAllowHeader(allowedMethods);
	}

	private extractMethods(route: RouteOptions): string[] {
		return Array.isArray(route.method) ? route.method : [route.method];
	}

	private getOrCreateBucket(url: string): ConstraintBucket {
		let bucket = this.index.get(url);
		if (!bucket) {
			bucket = new Map();
			this.index.set(url, bucket);
		}
		return bucket;
	}

	private getOrCreateMethodSet(
		bucket: ConstraintBucket,
		key: string,
	): MethodsSet {
		let methodSet = bucket.get(key);
		if (!methodSet) {
			methodSet = new Set();
			bucket.set(key, methodSet);
		}
		return methodSet;
	}

	private findCandidateMethods(
		buckets: ConstraintBucket,
		req: FastifyRequest,
	): MethodsSet[] {
		const host = extractHost(req);
		const version = extractVersion(req);
		const preferKey = createPreferKey(host, version);

		const candidates: MethodsSet[] = [];
		const preferredSet = buckets.get(preferKey);

		if (preferredSet) {
			candidates.push(preferredSet);
		}

		for (const methodSet of buckets.values()) {
			if (!candidates.includes(methodSet)) {
				candidates.push(methodSet);
			}
		}

		return candidates;
	}

	private unionMethods(candidates: MethodsSet[]): Set<Method> {
		const union = new Set<Method>();

		for (const methodSet of candidates) {
			for (const method of methodSet) {
				union.add(method);
			}
		}

		return union;
	}

	private formatAllowHeader(methods: Set<Method>): string {
		const methodsCopy = new Set(methods);

		// Si hay GET, agregar HEAD automáticamente
		if (methodsCopy.has("GET")) {
			methodsCopy.add("HEAD");
		}

		// Excluir OPTIONS (lo maneja @fastify/cors)
		methodsCopy.delete("OPTIONS");

		return Array.from(methodsCopy).sort().join(", ");
	}
}

// ============================================================================
// Plugin Factory
// ============================================================================

export function buildAuto405Plugin() {
	const routeIndex = new RouteIndex();

	return function auto405Plugin(
		instance: FastifyInstance,
		_opts: unknown,
		done: (err?: Error) => void,
	): void {
		// Registrar rutas en el índice
		instance.addHook("onRoute", (route: RouteOptions) => {
			const routeWithConfig = route as RouteWithConfig;

			if (routeWithConfig.config?.[kSeen]) {
				return;
			}

			if (!routeWithConfig.config) {
				routeWithConfig.config = {};
			}

			routeWithConfig.config[kSeen] = true;
			routeIndex.add(route);
		});

		// Decorar con manejador 405 por defecto
		instance.decorate(
			"auto405DefaultRoute",
			(): ((req: FastifyRequest, reply: FastifyReply) => void) =>
				function defaultRoute(req: FastifyRequest, reply: FastifyReply): void {
					const url = extractUrl(req);
					const allowHeader = routeIndex.getAllowedMethods(url, req);

					if (allowHeader) {
						const errorResponse: ErrorResponse = {
							statusCode: 405,
							error: "Method Not Allowed",
							message: `Method ${req.method} is not allowed for ${req.url}`,
						};

						reply.header("Allow", allowHeader).status(405).send(errorResponse);

						return;
					}

					const typedReply = reply as FastifyReplyTyped;
					typedReply.callNotFound();
				},
		);

		done();
	};
}
