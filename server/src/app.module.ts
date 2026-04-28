import { Module } from "@nestjs/common";

import { PlatformModule } from "./platform/platform.module";
import { HealthModule } from "./health/health.module";
import { UploadModule } from "./modules/upload/upload.module";
import { EvaluationModule } from "./modules/evaluation/evaluation.module";
import { CatalogModule } from "./modules/catalog/catalog.module";

/**
 * Root application module.
 * PlatformModule provides all infrastructure (config, database, logging, HTTP components, Azure).
 * Feature modules encapsulate bounded contexts.
 */
@Module({
	imports: [
		// Global infrastructure (config, database, logging, HTTP, Azure)
		PlatformModule,

		// Feature modules
		HealthModule,
		CatalogModule,
		UploadModule,
		EvaluationModule,
	],
	controllers: [],
	providers: [],
})
export class AppModule {}
