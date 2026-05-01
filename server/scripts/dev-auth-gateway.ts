import express, { Request, Response, NextFunction } from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import jwt, { JwtPayload, SignOptions } from "jsonwebtoken";
import crypto from "node:crypto";
import bodyParser from "body-parser";
import { URLSearchParams } from "node:url";

// =========================
// Tipos
// =========================
interface DevUser {
	id: string;
	username: string;
	password: string;
	name: string;
	roles: string[];
}

interface AuthCodeEntry {
	clientId: string;
	redirectUri: string;
	user: DevUser;
	scope: string;
	codeChallenge?: string;
	codeChallengeMethod?: string;
	createdAt: number;
}

interface RefreshTokenEntry {
	clientId: string;
	user: DevUser;
	scope: string;
	createdAt: number;
	expiresAt: number;
}

interface ClientPrincipalClaim {
	typ: string;
	val: string;
}

interface ClientPrincipal {
	auth_typ: string;
	name_typ: string;
	role_typ: string;
	claims: ClientPrincipalClaim[];
}

interface AccessTokenPayload extends JwtPayload {
	iss: string;
	aud: string | string[];
	sub: string;
	oid?: string;
	name?: string;
	preferred_username?: string;
	roles?: string[] | string;
	scope?: string;
	tid?: string;
}

interface IdTokenPayload extends JwtPayload {
	iss: string;
	aud: string | string[];
	sub: string;
	name?: string;
	preferred_username?: string;
}

interface IssuedTokens {
	access_token: string;
	id_token: string;
	refresh_token: string;
	expires_in: number;
	token_type: "Bearer";
}

// =========================
// Config
// =========================
const PORT: number = Number(process.env.DEV_AUTH_GATEWAY_PORT || 4100);
const AUTH_SECRET: string =
	process.env.DEV_AUTH_GATEWAY_SECRET || "super-dev-secret";
const ISSUER: string =
	process.env.DEV_AUTH_GATEWAY_ISSUER || `http://localhost:${PORT}/oidc`;
const CLIENT_ID: string =
	process.env.DEV_AUTH_GATEWAY_CLIENT_ID || "dev-mobile-client";
const API_AUDIENCE: string =
	process.env.DEV_AUTH_GATEWAY_API_AUDIENCE || "api://dev-api";
const BACKEND_URL: string =
	process.env.DEV_AUTH_GATEWAY_BACKEND_URL || "http://localhost:3000";

const ACCESS_TOKEN_LIFETIME = 3600; // s
const REFRESH_TOKEN_LIFETIME = 24 * 3600; // s

const LOG_PREFIX = "[DevAuthGateway]";

console.log(`${LOG_PREFIX} Starting with configuration:`, {
	PORT,
	ISSUER,
	CLIENT_ID,
	API_AUDIENCE,
	BACKEND_URL,
	ACCESS_TOKEN_LIFETIME,
	REFRESH_TOKEN_LIFETIME,
});

// =========================
// Estado en memoria
// =========================
const users: DevUser[] = [
	{
		id: "11111111-1111-1111-1111-111111111111",
		username: "dev@local",
		password: "devpass",
		name: "Dev User",
		roles: ["Uploader", "Admin"],
	},
];

const authCodes = new Map<string, AuthCodeEntry>();
const refreshTokens = new Map<string, RefreshTokenEntry>();

// =========================
// Helpers
// =========================
function base64UrlEncode(buf: Buffer): string {
	return buf
		.toString("base64")
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/g, "");
}

function verifyPkce(
	codeChallenge?: string,
	method?: string,
	codeVerifier?: string,
): boolean {
	console.log(`${LOG_PREFIX} verifyPkce`, {
		hasCodeChallenge: !!codeChallenge,
		method,
		hasCodeVerifier: !!codeVerifier,
	});

	if (!codeChallenge) return true; // relajado en dev
	if (!codeVerifier) return false;

	if (method && method.toLowerCase() !== "s256") {
		console.log(
			`${LOG_PREFIX} verifyPkce: non-S256 method (${method}) -> aceptado en dev`,
		);
		return true;
	}

	const hash = crypto.createHash("sha256").update(codeVerifier).digest();
	const computed = base64UrlEncode(hash);
	const ok = computed === codeChallenge;
	console.log(`${LOG_PREFIX} verifyPkce computed`, {
		computed,
		codeChallenge,
		ok,
	});
	return ok;
}

function issueTokens(input: { user: DevUser; scope: string }): IssuedTokens {
	const { user, scope } = input;
	const now = Math.floor(Date.now() / 1000);

	console.log(`${LOG_PREFIX} issueTokens`, {
		userId: user.id,
		username: user.username,
		scope,
		now,
	});

	const accessPayload: AccessTokenPayload = {
		iss: ISSUER,
		aud: API_AUDIENCE,
		sub: user.id,
		oid: user.id,
		name: user.name,
		preferred_username: user.username,
		roles: user.roles,
		scope,
		iat: now,
		nbf: now,
		exp: now + ACCESS_TOKEN_LIFETIME,
	};

	const idPayload: IdTokenPayload = {
		iss: ISSUER,
		aud: CLIENT_ID,
		sub: user.id,
		name: user.name,
		preferred_username: user.username,
		iat: now,
		nbf: now,
		exp: now + ACCESS_TOKEN_LIFETIME,
	};

	const signOpts: SignOptions = {
		algorithm: "HS256",
	};

	const access_token = jwt.sign(accessPayload, AUTH_SECRET, signOpts);
	const id_token = jwt.sign(idPayload, AUTH_SECRET, signOpts);

	const refresh_token = base64UrlEncode(crypto.randomBytes(32));
	const rtExpires = now + REFRESH_TOKEN_LIFETIME;

	refreshTokens.set(refresh_token, {
		clientId: CLIENT_ID,
		user,
		scope,
		createdAt: now,
		expiresAt: rtExpires,
	});

	console.log(`${LOG_PREFIX} Tokens issued`, {
		accessTokenPreview: access_token.slice(0, 16),
		refreshTokenPreview: refresh_token.slice(0, 16),
		rtExpires,
	});

	return {
		access_token,
		id_token,
		refresh_token,
		expires_in: ACCESS_TOKEN_LIFETIME,
		token_type: "Bearer",
	};
}

function buildClientPrincipalFromPayload(payload: AccessTokenPayload): string {
	const roles: string[] =
		Array.isArray(payload.roles) && payload.roles.length > 0
			? payload.roles.map(String)
			: payload.roles
				? [String(payload.roles)]
				: [];

	const claims: ClientPrincipalClaim[] = [];

	if (payload.name) {
		claims.push({ typ: "name", val: String(payload.name) });
	}
	if (payload.preferred_username) {
		claims.push({
			typ: "preferred_username",
			val: String(payload.preferred_username),
		});
	}
	if (payload.oid || payload.sub) {
		claims.push({ typ: "oid", val: String(payload.oid || payload.sub) });
	}
	if (payload.tid) {
		claims.push({ typ: "tid", val: String(payload.tid) });
	}
	for (const r of roles) {
		claims.push({ typ: "roles", val: r });
	}

	const principal: ClientPrincipal = {
		auth_typ: "aad",
		name_typ: "name",
		role_typ: "roles",
		claims,
	};

	const json = JSON.stringify(principal);
	const b64 = Buffer.from(json, "utf8").toString("base64");

	console.log(`${LOG_PREFIX} buildClientPrincipalFromPayload`, {
		userId: payload.sub,
		roles,
		b64Preview: b64.slice(0, 32),
	});

	return b64;
}

function parseBearer(req: Request): string | null {
	const hdr =
		(req.headers.authorization as string | undefined) ||
		(req.headers.Authorization as string | undefined);

	if (!hdr) return null;
	const parts = hdr.split(" ");
	if (parts.length !== 2 || parts[0] !== "Bearer") return null;
	return parts[1];
}

// =========================
// App
// =========================
const app = express();

app.use((req, _res, next) => {
	console.log(`${LOG_PREFIX} Incoming request`, {
		method: req.method,
		path: req.path,
		query: req.query,
	});
	next();
});

// bodyParser solo para rutas que NO van al proxy (body debe ir intacto al backend)
app.use("/oidc", bodyParser.urlencoded({ extended: false }));
app.use("/oidc", bodyParser.json());
app.use("/.auth", bodyParser.json());

// =========================
// 1) OIDC Discovery
// =========================
app.get(
	"/oidc/.well-known/openid-configuration",
	(_req: Request, res: Response) => {
		console.log(`${LOG_PREFIX} /.well-known/openid-configuration served`);
		res.json({
			issuer: ISSUER,
			authorization_endpoint: `${ISSUER}/authorize`,
			token_endpoint: `${ISSUER}/token`,
			id_token_signing_alg_values_supported: ["HS256"],
			response_types_supported: ["code"],
			grant_types_supported: ["authorization_code", "refresh_token"],
			token_endpoint_auth_methods_supported: ["none"],
			scopes_supported: ["openid", "offline_access", "api://dev-api/.default"],
		});
	},
);

// =========================
// 2) OIDC Authorize (Code + PKCE)
// =========================
app.get("/oidc/authorize", (req: Request, res: Response) => {
	const q = req.query as Record<string, string | string[] | undefined>;

	const client_id = Array.isArray(q.client_id) ? q.client_id[0] : q.client_id;
	const redirect_uri = Array.isArray(q.redirect_uri)
		? q.redirect_uri[0]
		: q.redirect_uri;
	const response_type = Array.isArray(q.response_type)
		? q.response_type[0]
		: q.response_type;
	const scope = Array.isArray(q.scope) ? q.scope[0] : q.scope;
	const state = Array.isArray(q.state) ? q.state[0] : q.state;
	const code_challenge = Array.isArray(q.code_challenge)
		? q.code_challenge[0]
		: q.code_challenge;
	const code_challenge_method = Array.isArray(q.code_challenge_method)
		? q.code_challenge_method[0]
		: q.code_challenge_method;

	console.log(`${LOG_PREFIX} /authorize`, {
		client_id,
		redirect_uri,
		response_type,
		scope,
		state,
		code_challenge_method,
		hasCodeChallenge: !!code_challenge,
	});

	if (!client_id || client_id !== CLIENT_ID) {
		console.error(`${LOG_PREFIX} /authorize invalid client_id`, {
			client_id,
			expected: CLIENT_ID,
		});
		return res.status(400).send("invalid client_id");
	}
	if (!redirect_uri) {
		console.error(`${LOG_PREFIX} /authorize missing redirect_uri`);
		return res.status(400).send("missing redirect_uri");
	}
	if (response_type !== "code") {
		console.error(`${LOG_PREFIX} /authorize unsupported response_type`, {
			response_type,
		});
		return res.status(400).send("unsupported response_type");
	}

	// Auto-login: siempre el primer usuario (dev) para simplificar
	const user = users[0];

	const code = base64UrlEncode(crypto.randomBytes(32));
	authCodes.set(code, {
		clientId: client_id,
		redirectUri: redirect_uri,
		user,
		scope: scope ?? "",
		codeChallenge: code_challenge,
		codeChallengeMethod: code_challenge_method,
		createdAt: Date.now(),
	});

	console.log(`${LOG_PREFIX} /authorize issued code`, {
		codePreview: code.slice(0, 16),
		userId: user.id,
		redirect_uri,
		scope,
	});

	const params = new URLSearchParams();
	params.set("code", code);
	if (state) params.set("state", state);

	const sep = redirect_uri.includes("?") ? "&" : "?";
	res.redirect(redirect_uri + sep + params.toString());
});

// =========================
// 3) OIDC Token endpoint
// =========================
app.post("/oidc/token", (req: Request, res: Response) => {
	const grant_type = req.body.grant_type as string | undefined;
	console.log(`${LOG_PREFIX} /token`, {
		grant_type,
		rawBodyKeys: Object.keys(req.body),
	});

	if (grant_type === "authorization_code") {
		const code = req.body.code as string | undefined;
		const redirect_uri = req.body.redirect_uri as string | undefined;
		const client_id = req.body.client_id as string | undefined;
		const code_verifier = req.body.code_verifier as string | undefined;

		console.log(`${LOG_PREFIX} /token[authorization_code]`, {
			client_id,
			hasCode: !!code,
			redirect_uri,
			hasCodeVerifier: !!code_verifier,
		});

		if (!code) {
			console.error(`${LOG_PREFIX} /token missing code`);
			return res.status(400).json({ error: "invalid_grant" });
		}

		const entry = authCodes.get(code);
		if (!entry) {
			console.error(`${LOG_PREFIX} /token invalid code (not found)`);
			return res.status(400).json({ error: "invalid_grant" });
		}
		authCodes.delete(code);

		if (client_id !== entry.clientId) {
			console.error(`${LOG_PREFIX} /token invalid_client`, {
				client_id,
				expected: entry.clientId,
			});
			return res.status(400).json({ error: "invalid_client" });
		}
		if (redirect_uri !== entry.redirectUri) {
			console.error(`${LOG_PREFIX} /token invalid_redirect_uri`, {
				redirect_uri,
				expected: entry.redirectUri,
			});
			return res.status(400).json({ error: "invalid_redirect_uri" });
		}
		if (
			!verifyPkce(entry.codeChallenge, entry.codeChallengeMethod, code_verifier)
		) {
			console.error(`${LOG_PREFIX} /token PKCE failed`, {
				entryCodeChallenge: entry.codeChallenge,
				method: entry.codeChallengeMethod,
			});
			return res.status(400).json({
				error: "invalid_grant",
				error_description: "PKCE failed",
			});
		}

		const tokens = issueTokens({ user: entry.user, scope: entry.scope });
		console.log(`${LOG_PREFIX} /token[authorization_code] success`, {
			userId: entry.user.id,
			accessTokenPreview: tokens.access_token.slice(0, 16),
		});
		return res.json(tokens);
	}

	if (grant_type === "refresh_token") {
		const rt = req.body.refresh_token as string | undefined;
		console.log(`${LOG_PREFIX} /token[refresh_token]`, {
			hasRefreshToken: !!rt,
		});
		if (!rt) {
			console.error(`${LOG_PREFIX} /token missing refresh_token`);
			return res.status(400).json({ error: "invalid_grant" });
		}

		const entry = refreshTokens.get(rt);
		const now = Math.floor(Date.now() / 1000);

		if (!entry) {
			console.error(`${LOG_PREFIX} /token invalid refresh_token (not found)`);
			return res.status(400).json({ error: "invalid_grant" });
		}
		if (entry.expiresAt < now) {
			console.error(`${LOG_PREFIX} /token refresh_token expired`, {
				expiresAt: entry.expiresAt,
				now,
			});
			return res.status(400).json({ error: "invalid_grant" });
		}

		const tokens = issueTokens({ user: entry.user, scope: entry.scope });
		console.log(`${LOG_PREFIX} /token[refresh_token] success`, {
			userId: entry.user.id,
			accessTokenPreview: tokens.access_token.slice(0, 16),
		});
		return res.json(tokens);
	}

	console.error(`${LOG_PREFIX} /token unsupported_grant_type`, { grant_type });
	return res.status(400).json({ error: "unsupported_grant_type" });
});

// =========================
// 4) /.auth/me (similar a Easy Auth)
// =========================
app.get("/.auth/me", (req: Request, res: Response) => {
	const token = parseBearer(req);
	console.log(`${LOG_PREFIX} /.auth/me`, {
		hasBearer: !!token,
	});
	if (!token) {
		return res.status(401).json({ clientPrincipal: null });
	}

	try {
		const decoded = jwt.verify(token, AUTH_SECRET, {
			algorithms: ["HS256"],
			audience: API_AUDIENCE,
			issuer: ISSUER,
		}) as AccessTokenPayload;

		console.log(`${LOG_PREFIX} /.auth/me token verified`, {
			sub: decoded.sub,
			username: decoded.preferred_username ?? decoded.name ?? null,
		});

		const principalB64 = buildClientPrincipalFromPayload(decoded);
		const principalJson = Buffer.from(principalB64, "base64").toString("utf8");
		const clientPrincipal = JSON.parse(principalJson) as ClientPrincipal;

		res.json({ clientPrincipal });
	} catch (err) {
		const msg =
			err instanceof Error ? err.message : typeof err === "string" ? err : "";
		console.error("Invalid token in /.auth/me:", msg);
		res.status(401).json({ clientPrincipal: null });
	}
});

// =========================
// 5) Middleware Easy Auth + proxy /api
// =========================
function easyAuthMiddleware(
	req: Request,
	res: Response,
	next: NextFunction,
): void {
	const token = parseBearer(req);
	console.log(`${LOG_PREFIX} easyAuthMiddleware`, {
		path: req.path,
		hasBearer: !!token,
	});
	if (!token) {
		res.status(401).send("Unauthorized (no Bearer token)");
		return;
	}

	// Dev bypass: accept auth-bypass-* tokens from mobile
	if (token.startsWith("auth-bypass-")) {
		console.log(`${LOG_PREFIX} easyAuthMiddleware bypass token accepted`);
		const bypassPayload: AccessTokenPayload = {
			iss: ISSUER,
			aud: API_AUDIENCE,
			sub: "00000000-0000-0000-0000-000000000000",
			oid: "00000000-0000-0000-0000-000000000000",
			name: "Dev Bypass User",
			preferred_username: "dev@local",
			roles: ["Uploader", "Admin"],
			iat: Math.floor(Date.now() / 1000),
			nbf: Math.floor(Date.now() / 1000),
			exp: Math.floor(Date.now() / 1000) + 3600,
		};
		const principalB64 = buildClientPrincipalFromPayload(bypassPayload);
		const headers = req.headers as Record<string, string | string[] | undefined>;
		headers["x-ms-client-principal"] = principalB64;
		headers["x-ms-token-aad-access-token"] = token;
		return next();
	}

	try {
		const decoded = jwt.verify(token, AUTH_SECRET, {
			algorithms: ["HS256"],
			audience: API_AUDIENCE,
			issuer: ISSUER,
		}) as AccessTokenPayload;

		console.log(`${LOG_PREFIX} easyAuthMiddleware token verified`, {
			sub: decoded.sub,
			username: decoded.preferred_username ?? decoded.name ?? null,
			scope: decoded.scope ?? null,
		});

		const principalB64 = buildClientPrincipalFromPayload(decoded);

		const headers = req.headers as Record<
			string,
			string | string[] | undefined
		>;
		headers["x-ms-client-principal"] = principalB64;
		headers["x-ms-token-aad-access-token"] = token;

		next();
	} catch (err) {
		const msg =
			err instanceof Error ? err.message : typeof err === "string" ? err : "";
		console.error("Token validation failed:", msg);
		res.status(401).send("Unauthorized (invalid token)");
	}
}

app.use(
	"/api",
	easyAuthMiddleware,
	createProxyMiddleware({
		target: BACKEND_URL,
		changeOrigin: true,
		pathRewrite: (path, req) => req.originalUrl.split('?')[0] || path,
		on: {
			proxyReq: (_proxyReq, req) => {
				console.log(`${LOG_PREFIX} Proxying /api request`, {
					method: req.method,
					path: req.path,
					target: BACKEND_URL,
				});
			},
		},
	}),
);

// =========================
// Arranque
// =========================
app.listen(PORT, "0.0.0.0", () => {
	console.log(`${LOG_PREFIX} listening on port ${PORT}`);
	console.log(`${LOG_PREFIX} OIDC Issuer: ${ISSUER}`);
	console.log(`${LOG_PREFIX} Backend URL: ${BACKEND_URL}`);
});
