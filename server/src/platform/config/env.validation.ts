import { plainToInstance, Transform } from "class-transformer";
import {
	IsEnum,
	IsInt,
	IsOptional,
	IsString,
	IsUrl,
	IsBoolean,
	Max,
	Min,
	validateSync,
} from "class-validator";

enum Environment {
	Local = "local",
	Production = "production",
}

export class EnvironmentVariablesValidator {
	@IsEnum(Environment)
	@IsOptional()
	NODE_ENV: Environment = Environment.Local;

	@IsString()
	@IsOptional()
	APP_NAME: string = "FrutSmart API";

	@IsString()
	@IsOptional()
	APP_VERSION: string = "1.0.0";
	// NOTE: API_VERSION (old) unified to APP_VERSION. If API_VERSION present, keep fallback via dotenv expansion or map externally.

	@IsInt()
	@Min(0)
	@Max(65535)
	@Transform(({ value }: { value: string }) => parseInt(value, 10))
	@IsOptional()
	PORT: number = 3000;

	@IsString()
	@IsOptional()
	APP_HOST: string = "0.0.0.0";

	@IsString()
	@IsOptional()
	API_PREFIX: string = "api/v1";

	@IsUrl({ require_tld: false })
	@IsOptional()
	APP_URL: string = "http://localhost:3000";

	@IsUrl({ require_tld: false })
	@IsOptional()
	FRONTEND_DOMAIN: string;

	@IsUrl({ require_tld: false })
	@IsOptional()
	BACKEND_DOMAIN: string;

	@IsString()
	@IsOptional()
	APP_FALLBACK_LANGUAGE: string = "en";

	@IsString()
	@IsOptional()
	APP_HEADER_LANGUAGE: string = "x-custom-lang";

	// Database
	@IsString()
	@IsOptional()
	DATABASE_URL: string;

	@IsString()
	@IsOptional()
	DATABASE_HOST: string = "localhost";

	@IsInt()
	@Min(1)
	@Max(65535)
	@Transform(({ value }: { value: string }) => parseInt(value, 10))
	@IsOptional()
	DATABASE_PORT: number = 5432;

	@IsString()
	@IsOptional()
	DATABASE_USERNAME: string = "postgres";

	@IsString()
	@IsOptional()
	DATABASE_PASSWORD: string;

	@IsString()
	@IsOptional()
	DATABASE_NAME: string = "frutsmart";

	@IsBoolean()
	@Transform(({ value }) => value === "true")
	@IsOptional()
	DATABASE_SYNCHRONIZE: boolean = false;

	@IsBoolean()
	@Transform(({ value }) => value === "true")
	@IsOptional()
	DATABASE_LOGGING: boolean = false;

	@IsBoolean()
	@Transform(({ value }) => value === "true")
	@IsOptional()
	DATABASE_DROP_SCHEMA: boolean = false;

	@IsBoolean()
	@Transform(({ value }) => value === "true")
	@IsOptional()
	DATABASE_MIGRATIONS_RUN: boolean = false;

	@IsBoolean()
	@Transform(({ value }) => value === "true")
	@IsOptional()
	DATABASE_SSL: boolean = false;

	@IsInt()
	@Transform(({ value }) => parseInt(value, 10))
	@IsOptional()
	DATABASE_MAX_CONNECTIONS?: number;

	@IsInt()
	@Transform(({ value }) => parseInt(value, 10))
	@IsOptional()
	DATABASE_CONNECT_TIMEOUT_MS?: number;

	@IsInt()
	@Transform(({ value }) => parseInt(value, 10))
	@IsOptional()
	DATABASE_ACQUIRE_TIMEOUT_MS?: number;

	@IsInt()
	@Transform(({ value }) => parseInt(value, 10))
	@IsOptional()
	DATABASE_TIMEOUT?: number;

	@IsInt()
	@Transform(({ value }) => parseInt(value, 10))
	@IsOptional()
	DATABASE_RETRY_ATTEMPTS?: number;

	@IsInt()
	@Transform(({ value }) => parseInt(value, 10))
	@IsOptional()
	DATABASE_RETRY_DELAY?: number;

	// CORS
	@IsString()
	@IsOptional()
	CORS_ORIGINS?: string;

	// API Key security
	@IsString()
	@IsOptional()
	API_KEY_HEADER?: string;

	@IsString()
	@IsOptional()
	INTERNAL_API_SECRET?: string;

	// Azure Storage
	@IsString()
	@IsOptional()
	AZURE_STORAGE_ACCOUNT_URL?: string;

	@IsString()
	@IsOptional()
	AZURE_STORAGE_CONNECTION_STRING?: string;

	@IsString()
	@IsOptional()
	AZURE_STORAGE_ACCOUNT_NAME?: string;

	@IsString()
	@IsOptional()
	AZURE_STORAGE_ACCOUNT_KEY?: string;

	@IsString()
	@IsOptional()
	AZURE_DEFAULT_CONTAINER?: string;

	@IsString()
	@IsOptional()
	AZURE_STORAGE_PUBLIC_BASE_URL?: string;

	@IsString()
	@IsOptional()
	AZURE_STORAGE_CONTAINER_PLANT?: string;

	@IsString()
	@IsOptional()
	AZURE_STORAGE_CONTAINER_FIELD?: string;

	@IsInt()
	@Transform(({ value }) => parseInt(value, 10))
	@IsOptional()
	AZURE_STORAGE_SAS_TTL_MINUTES?: number;

	// Observability
	@IsString()
	@IsOptional()
	OTEL_EXPORTER_OTLP_ENDPOINT?: string;
}

export function validate(
	config: Record<string, unknown>,
): EnvironmentVariablesValidator {
	const validatedConfig = plainToInstance(
		EnvironmentVariablesValidator,
		config,
		{
			enableImplicitConversion: true,
		},
	);

	const errors = validateSync(validatedConfig, {
		skipMissingProperties: false,
	});

	if (errors.length > 0) {
		throw new Error(errors.toString());
	}
	return validatedConfig;
}
