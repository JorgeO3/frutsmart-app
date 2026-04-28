import { DataSource } from "typeorm";
import { config as loadEnv } from "dotenv";
import { join } from "node:path";
import databaseConfig from "../config/database.config";

// ---------------------------------------------------------------------------
// Environment bootstrap (standalone usage for CLI / migrations)
// ---------------------------------------------------------------------------
const envFile =
	process.env.NODE_ENV === "production" ? ".env.production" : ".env.local";
loadEnv({ path: envFile });

const isProduction = process.env.NODE_ENV === "production";
const appDir = process.cwd();
const srcOrDist = isProduction ? "dist" : "src";

// Reuse the database config factory logic: registerAs returns a function; invoke to get config
const db = (
	databaseConfig as unknown as () => ReturnType<typeof databaseConfig>
)();
// Above cast works because registerAs returns a function with the produced config shape
// Alternatively, we could duplicate logic, but we intentionally centralize here.

// Force synchronize false for migrations (safety) regardless of config
const synchronize = false;

export const AppDataSource = new DataSource({
	type: "postgres",
	url: db.url,
	host: db.host,
	port: db.port,
	username: db.username,
	password: db.password,
	database: db.database,
	synchronize,
	logging: db.logging,
	dropSchema: false,
	migrationsRun: false,
	ssl: db.ssl,
	entities: [
		join(
			appDir,
			srcOrDist,
			"modules/**/infrastructure/**/*.orm-entity{.ts,.js}",
		),
	],
	migrations: [
		join(appDir, srcOrDist, "platform/database/migrations/*{.ts,.js}"),
	],
	subscribers: [
		join(appDir, srcOrDist, "platform/database/subscribers/*{.ts,.js}"),
	],
	migrationsTableName: "typeorm_migrations",
	migrationsTransactionMode: "each",
	extra: {
		max: db.maxConnections,
		connectionTimeoutMillis: db.connectTimeoutMS,
		acquireTimeoutMillis: db.acquireTimeoutMS,
		statement_timeout: 300000,
		query_timeout: 300000,
	},
	// retryAttempts / retryDelay are Nest TypeOrmModule level options, not DataSource ctor options
});
