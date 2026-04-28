import { registerAs } from "@nestjs/config";
import { AppConfig } from "./config.type";

enum Environment {
	Local = "local",
	Production = "production",
}

export default registerAs<AppConfig>("app", (): AppConfig => {
	return {
		nodeEnv: process.env.NODE_ENV || Environment.Local,
		name: process.env.APP_NAME || "FrutSmart API",
		// Use APP_VERSION (aligned with env.validation); previously used API_VERSION
		version: process.env.APP_VERSION || "1.0.0",
		workingDirectory: process.env.PWD || process.cwd(),
		frontendDomain: process.env.FRONTEND_DOMAIN,
		backendDomain: process.env.BACKEND_DOMAIN || "http://localhost:3000",
		port: process.env.PORT ? parseInt(process.env.PORT, 10) : 3000,
		host: process.env.APP_HOST || "0.0.0.0",
		apiPrefix: process.env.API_PREFIX || "api/v1",
		url: process.env.APP_URL || "http://localhost:3000",
		fallbackLanguage: process.env.APP_FALLBACK_LANGUAGE || "en",
		headerLanguage: process.env.APP_HEADER_LANGUAGE || "x-custom-lang",
		rateLimitEnabled: process.env.RATE_LIMIT_ENABLED === "true" || false,
		rateLimitMax: process.env.RATE_LIMIT_MAX
			? parseInt(process.env.RATE_LIMIT_MAX, 10)
			: 100,
		rateLimitTimeWindowMs: process.env.RATE_LIMIT_TIME_WINDOW_MS
			? parseInt(process.env.RATE_LIMIT_TIME_WINDOW_MS, 10)
			: 60000,
	};
});
