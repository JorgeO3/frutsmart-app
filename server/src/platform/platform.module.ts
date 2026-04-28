import { ClassSerializerInterceptor, Global, Module } from "@nestjs/common";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { Reflector } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";

// Config
import { ConfigFacade } from "./config/config.facade";
import { configModuleConfig, getTypeOrmModule } from "./config/modules.config";

// Logging
import { PinoLoggerModule } from "./logging/pino-logger.module";

// Azure Integration
import { AzureBlobModule } from "./integrations/azure/azure-blob.module";

// HTTP Infrastructure
import {
	AllExceptionsFilter,
	ValidationExceptionFilter,
	EasyAuthGuard,
	RolesGuard,
	CorrelationIdInterceptor,
	LoggingInterceptor,
} from "./http/http.types";

/**
 * PlatformModule
 *
 * Global infrastructure module that provides:
 * - Configuration (ConfigModule + ConfigFacade)
 * - Database (TypeORM)
 * - Logging (Pino)
 * - HTTP infrastructure (Filters, Guards, Interceptors, Pipes)
 * - Azure integrations (Blob Storage)
 *
 * This module is marked as @Global() and should be imported only in AppModule.
 */
@Global()
@Module({
	imports: [
		// Configuration (already configured with forRoot)
		configModuleConfig,

		// Database
		...getTypeOrmModule(),

		// Logging
		PinoLoggerModule,

		// External Integrations
		AzureBlobModule,
	],
	providers: [
		// Config Facade
		ConfigFacade,

		// Reflector for guards/interceptors
		Reflector,

		// Global Guards
		{ provide: APP_GUARD, useClass: EasyAuthGuard },
		{ provide: APP_GUARD, useClass: RolesGuard },

		// Global Interceptors (registration order = execution order)
		{ provide: APP_INTERCEPTOR, useClass: CorrelationIdInterceptor },
		{ provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
		{ provide: APP_INTERCEPTOR, useClass: ClassSerializerInterceptor },

		// Global Filters
		{ provide: APP_FILTER, useClass: ValidationExceptionFilter },
		{ provide: APP_FILTER, useClass: AllExceptionsFilter },
	],
	exports: [
		// Re-export config for feature modules
		ConfigModule,
		ConfigFacade,

		// Re-export database for feature modules
		TypeOrmModule,

		// Re-export logging
		PinoLoggerModule,

		// Re-export Azure
		AzureBlobModule,
	],
})
export class PlatformModule {}
