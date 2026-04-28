import { DynamicModule } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import appConfig from "./app.config";
import corsConfig from "./cors.config";
import databaseConfig from "./database.config";
import azureConfig from "./azure.config";
import securityConfig from "./security.config";
import { validate } from "./env.validation";
import { typeOrmModuleOptions } from "./typeorm-module.config";

/**
 * Configuración del módulo ConfigModule con todas sus opciones
 * Maneja correctamente archivos de entorno por NODE_ENV
 */
export const configModuleConfig = ConfigModule.forRoot({
	isGlobal: true,
	envFilePath: getEnvFilePaths(),
	load: [appConfig, corsConfig, databaseConfig, azureConfig, securityConfig],
	validate,
	cache: true, // Cache configurations for better performance
	expandVariables: true, // Allow variable expansion in .env files
});

/**
 * Obtiene las rutas de archivos de entorno
 * Solo maneja dos entornos: local y production
 */
function getEnvFilePaths(): string[] {
	const isProduction = process.env.NODE_ENV === "production";

	return isProduction
		? [".env.production"] // Production environment
		: [".env.local"]; // Local development environment
}

/**
 * Configuración condicional de TypeORM
 * Solo se incluye si hay configuración de base de datos disponible
 */
export function getTypeOrmModule(): DynamicModule[] {
	if (process.env.DATABASE_HOST || process.env.DATABASE_URL) {
		return [TypeOrmModule.forRootAsync(typeOrmModuleOptions)];
	}
	return []; // No TypeORM module when no database config
}
