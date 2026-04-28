import { registerAs } from "@nestjs/config";

export interface DatabaseConfig {
	type: "postgres";
	url?: string;
	host?: string;
	port: number;
	username?: string;
	password?: string;
	database?: string;
	synchronize: boolean;
	logging: boolean;
	dropSchema: boolean;
	migrationsRun: boolean;
	ssl?: boolean | { rejectUnauthorized: boolean };
	maxConnections: number;
	connectTimeoutMS: number;
	acquireTimeoutMS: number;
	timeout: number;
	retryAttempts: number;
	retryDelay: number;
}

export default registerAs("database", (): DatabaseConfig => {
	const isProduction = process.env.NODE_ENV === "production";
	const isLocal = process.env.NODE_ENV === "local";

	return {
		type: "postgres",
		url: process.env.DATABASE_URL,
		host: process.env.DATABASE_HOST,
		port: process.env.DATABASE_PORT
			? parseInt(process.env.DATABASE_PORT, 10)
			: 5432,
		username: process.env.DATABASE_USERNAME,
		password: process.env.DATABASE_PASSWORD,
		database: process.env.DATABASE_NAME,
		synchronize: process.env.DATABASE_SYNCHRONIZE === "true" && !isProduction,
		logging: process.env.DATABASE_LOGGING === "true" || isLocal,
		dropSchema: process.env.DATABASE_DROP_SCHEMA === "true" && !isProduction,
		migrationsRun:
			process.env.DATABASE_MIGRATIONS_RUN === "true" || isProduction,
		ssl:
			process.env.DATABASE_SSL === "true" || isProduction
				? { rejectUnauthorized: false }
				: false,
		maxConnections: process.env.DATABASE_MAX_CONNECTIONS
			? parseInt(process.env.DATABASE_MAX_CONNECTIONS, 10)
			: isProduction
				? 50
				: 100,
		connectTimeoutMS: process.env.DATABASE_CONNECT_TIMEOUT_MS
			? parseInt(process.env.DATABASE_CONNECT_TIMEOUT_MS, 10)
			: isProduction
				? 30000
				: 60000,
		acquireTimeoutMS: process.env.DATABASE_ACQUIRE_TIMEOUT_MS
			? parseInt(process.env.DATABASE_ACQUIRE_TIMEOUT_MS, 10)
			: isProduction
				? 30000
				: 60000,
		timeout: process.env.DATABASE_TIMEOUT
			? parseInt(process.env.DATABASE_TIMEOUT, 10)
			: isProduction
				? 10000
				: 20000,
		retryAttempts: process.env.DATABASE_RETRY_ATTEMPTS
			? parseInt(process.env.DATABASE_RETRY_ATTEMPTS, 10)
			: isProduction
				? 3
				: 10,
		retryDelay: process.env.DATABASE_RETRY_DELAY
			? parseInt(process.env.DATABASE_RETRY_DELAY, 10)
			: isProduction
				? 5000
				: 3000,
	};
});
