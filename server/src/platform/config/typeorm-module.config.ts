import { ConfigService } from "@nestjs/config";
import { TypeOrmModuleAsyncOptions } from "@nestjs/typeorm";
import { AllConfigType } from "./config.type";

export const typeOrmModuleOptions: TypeOrmModuleAsyncOptions = {
	inject: [ConfigService],
	useFactory: (configService: ConfigService<AllConfigType>) => {
		const dbConfig = configService.getOrThrow("database", { infer: true });

		// Verificar que tenemos configuración válida
		if (!dbConfig.url && !dbConfig.host) {
			throw new Error(
				"Database configuration is incomplete: Either DATABASE_URL or DATABASE_HOST must be provided",
			);
		}

		console.log("Configuring database connection...");

		return {
			type: "postgres",
			url: dbConfig.url,
			host: dbConfig.host,
			port: dbConfig.port,
			username: dbConfig.username,
			password: dbConfig.password,
			database: dbConfig.database,
			synchronize: dbConfig.synchronize,
			logging: dbConfig.logging,
			dropSchema: dbConfig.dropSchema,
			migrationsRun: dbConfig.migrationsRun,
			ssl: dbConfig.ssl,
			extra: {
				max: dbConfig.maxConnections,
				connectionTimeoutMillis: dbConfig.connectTimeoutMS,
				acquireTimeoutMillis: dbConfig.acquireTimeoutMS,
				timeout: dbConfig.timeout,
			},
			retryAttempts: dbConfig.retryAttempts,
			retryDelay: dbConfig.retryDelay,
			entities: ["dist/modules/**/infrastructure/**/*.orm-entity.js"],
			migrations: ["dist/platform/database/migrations/*{.ts,.js}"],
		};
	},
};
