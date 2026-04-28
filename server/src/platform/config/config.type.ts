import { CorsConfig } from "./cors.config";
import { DatabaseConfig as DbRuntimeConfig } from "./database.config";

// New config modules (azure, security) introduced; optional future placeholders removed

export type AllConfigType = {
	app: AppConfig;
	cors: CorsConfig;
	database: DbRuntimeConfig;
	azure: AzureConfig;
	security: SecurityConfig;
};

export type AppConfig = {
	nodeEnv: string;
	name: string;
	version: string;
	workingDirectory: string;
	frontendDomain?: string;
	backendDomain: string;
	port: number;
	host?: string;
	apiPrefix: string;
	url: string;
	fallbackLanguage: string;
	headerLanguage: string;
	rateLimitEnabled: boolean;
	rateLimitMax: number;
	rateLimitTimeWindowMs: number;
};

// Legacy DatabaseConfig type removed in favor of runtime one from database.config.ts

// Azure storage configuration
export type AzureConfig = {
	accountUrl?: string;
	connectionString?: string;
	accountName?: string;
	accountKey?: string;
	publicBaseUrl?: string;
	containerPlant?: string;
	containerField?: string;
	defaultContainer?: string;
	sasTtlMinutes?: number;
};

// Security / internal API key configuration
export type SecurityConfig = {
	apiKeyHeader?: string;
	internalApiSecret?: string;
};
