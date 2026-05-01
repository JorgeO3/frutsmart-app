import { registerAs } from "@nestjs/config";
import { AppConfig } from "./config.type";

enum Environment {
  Local = "local",
  Production = "production",
}

// This configuration is designed for production first, with sensible defaults.
export default registerAs<AppConfig>("app", (): AppConfig => {
  return {
    nodeEnv: process.env.BACKEND_NODE_ENV || Environment.Production,
    name: process.env.BACKEND_APP_NAME || "FrutSmart API",
    version: process.env.BACKEND_APP_VERSION || "1.0.0",
    workingDirectory: process.env.BACKEND_PWD || process.cwd(),
    port: process.env.BACKEND_PORT ? parseInt(process.env.BACKEND_PORT, 10) : 80,
    host: process.env.BACKEND_APP_HOST || "0.0.0.0",
    apiPrefix: process.env.BACKEND_API_PREFIX || "api/v1",
    url: process.env.BACKEND_APP_URL || "http://localhost:80",
    rateLimitEnabled: process.env.BACKEND_RATE_LIMIT_ENABLED === "false" ? false : true,
    rateLimitMax: process.env.BACKEND_RATE_LIMIT_MAX
      ? parseInt(process.env.BACKEND_RATE_LIMIT_MAX, 10)
      : 300,
    rateLimitTimeWindowMs: process.env.BACKEND_RATE_LIMIT_TIME_WINDOW_MS
      ? parseInt(process.env.BACKEND_RATE_LIMIT_TIME_WINDOW_MS, 10)
      : 60000,
    logoLevel: process.env.BACKEND_LOG_LEVEL || "warn",
    logFileEnabled: process.env.BACKEND_LOG_FILE_ENABLED === "true" ? true : false,
    swaggerEnabled: process.env.BACKEND_SWAGGER_ENABLED === "false" ? false : true,
    swaggerPath: process.env.BACKEND_SWAGGER_PATH || "docs",
  };
});
