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
  const isProduction = process.env.BACKEND_NODE_ENV === "production";
  const isLocal = process.env.BACKEND_NODE_ENV === "local";

  return {
    type: "postgres",
    url: process.env.BACKEND_DATABASE_URL,
    host: process.env.BACKEND_DATABASE_HOST,
    port: process.env.BACKEND_DATABASE_PORT
      ? parseInt(process.env.BACKEND_DATABASE_PORT, 10)
      : 5432,
    username: process.env.BACKEND_DATABASE_USERNAME,
    password: process.env.BACKEND_DATABASE_PASSWORD,
    database: process.env.BACKEND_DATABASE_NAME,
    synchronize: process.env.BACKEND_DATABASE_SYNCHRONIZE === "true" && !isProduction,
    logging: process.env.BACKEND_DATABASE_LOGGING === "true" || isLocal,
    dropSchema: process.env.BACKEND_DATABASE_DROP_SCHEMA === "true" && !isProduction,
    migrationsRun:
      process.env.BACKEND_DATABASE_MIGRATIONS_RUN === "true" || isProduction,
    ssl:
      process.env.BACKEND_DATABASE_SSL === "true" || isProduction
        ? { rejectUnauthorized: false }
        : false,
    maxConnections: process.env.BACKEND_DATABASE_MAX_CONNECTIONS
      ? parseInt(process.env.BACKEND_DATABASE_MAX_CONNECTIONS, 10)
      : isProduction
        ? 50
        : 100,
    connectTimeoutMS: process.env.BACKEND_DATABASE_CONNECT_TIMEOUT_MS
      ? parseInt(process.env.BACKEND_DATABASE_CONNECT_TIMEOUT_MS, 10)
      : isProduction
        ? 30000
        : 60000,
    acquireTimeoutMS: process.env.BACKEND_DATABASE_ACQUIRE_TIMEOUT_MS
      ? parseInt(process.env.BACKEND_DATABASE_ACQUIRE_TIMEOUT_MS, 10)
      : isProduction
        ? 30000
        : 60000,
    timeout: process.env.BACKEND_DATABASE_TIMEOUT
      ? parseInt(process.env.BACKEND_DATABASE_TIMEOUT, 10)
      : isProduction
        ? 10000
        : 20000,
    retryAttempts: process.env.BACKEND_DATABASE_RETRY_ATTEMPTS
      ? parseInt(process.env.BACKEND_DATABASE_RETRY_ATTEMPTS, 10)
      : isProduction
        ? 3
        : 10,
    retryDelay: process.env.BACKEND_DATABASE_RETRY_DELAY
      ? parseInt(process.env.BACKEND_DATABASE_RETRY_DELAY, 10)
      : isProduction
        ? 5000
        : 3000,
  };
});
