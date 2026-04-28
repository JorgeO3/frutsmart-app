import { Global, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ConfigFacade } from "@platform/config/config.facade";
import { CatalogModule } from './catalog/catalog.module';

@Global()
@Module({
	imports: [ConfigModule, CatalogModule],
	providers: [ConfigFacade],
	exports: [ConfigFacade],
})
export class GlobalModule {}
