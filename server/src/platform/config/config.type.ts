import { CorsConfig } from "./cors.config";
import { DatabaseConfig as DbRuntimeConfig } from "./database.config";

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
  port: number;
  host?: string;
  apiPrefix: string;
  url: string;
  rateLimitEnabled: boolean;
  rateLimitMax: number;
  rateLimitTimeWindowMs: number;
  logoLevel: string;
  logFileEnabled: boolean;
  swaggerEnabled: boolean;
  swaggerPath: string;
};

export type AzureConfig = {
  accountUrl?: string;
  publicBaseUrl?: string;
  containerPlant?: string;
  containerField?: string;
  defaultContainer?: string;
  sasTtlMinutes?: number;
  sasVersion?: string;
};

export type SecurityConfig = {
  apiKeyHeader?: string;
  internalApiSecret?: string;
};
