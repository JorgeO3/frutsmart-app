import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

// ORM Entities
import { ModelOrmEntity } from "./infrastructure/persistence/entities/model.orm-entity";
import { ProgramOrmEntity } from "./infrastructure/persistence/entities/program.orm-entity";
import { LotOrmEntity } from "./infrastructure/persistence/entities/lot.orm-entity";
import { CenterOrmEntity } from "./infrastructure/persistence/entities/center.orm-entity";
import { ProviderOrmEntity } from "./infrastructure/persistence/entities/provider.orm-entity";
import { SubProviderOrmEntity } from "./infrastructure/persistence/entities/sub-provider.orm-entity";

// Repositories
import { MODEL_REPOSITORY } from "./application/ports/repositories/model.repository.port";
import { PROGRAM_REPOSITORY } from "./application/ports/repositories/program.repository.port";
import { LOT_REPOSITORY } from "./application/ports/repositories/lot.repository.port";
import { CENTER_REPOSITORY } from "./application/ports/repositories/center.repository.port";
import { PROVIDER_REPOSITORY } from "./application/ports/repositories/provider.repository.port";
import { SUB_PROVIDER_REPOSITORY } from "./application/ports/repositories/sub-provider.repository.port";
import { ModelTypeOrmRepository } from "./infrastructure/persistence/repositories/model.typeorm-repo";
import { ProgramTypeOrmRepository } from "./infrastructure/persistence/repositories/program.typeorm-repo";
import { LotTypeOrmRepository } from "./infrastructure/persistence/repositories/lot.typeorm-repo";
import { CenterTypeOrmRepository } from "./infrastructure/persistence/repositories/center.typeorm-repo";
import { ProviderTypeOrmRepository } from "./infrastructure/persistence/repositories/provider.typeorm-repo";
import { SubProviderTypeOrmRepository } from "./infrastructure/persistence/repositories/sub-provider.typeorm-repo";
import { CatalogOrmMapper } from "./infrastructure/persistence/mappers/catalog-orm.mapper";

// Use Cases
import { CreateModelUseCase } from "./application/use-cases/create-model.use-case";
import { CreateProgramUseCase } from "./application/use-cases/create-program.use-case";
import { CreateLotUseCase } from "./application/use-cases/create-lot.use-case";
import { CreateCenterUseCase } from "./application/use-cases/create-center.use-case";
import { CreateProviderUseCase } from "./application/use-cases/create-provider.use-case";
import { CreateSubProviderUseCase } from "./application/use-cases/create-sub-provider.use-case";
import {
	ListModelsUseCase,
	ListProgramsUseCase,
	ListLotsUseCase,
	ListCentersUseCase,
	ListProvidersUseCase,
	ListSubProvidersUseCase,
} from "./application/use-cases/list.use-cases";
import {
	GetModelByIdUseCase,
	GetProgramByIdUseCase,
	GetLotByIdUseCase,
	GetCenterByIdUseCase,
	GetProviderByIdUseCase,
	GetSubProviderByIdUseCase,
} from "./application/use-cases/get-by-id.use-cases";

// Controller & Presenter
import { CatalogController } from "./interface/http/controllers/catalog.controller";
import { CatalogPresenter } from "./interface/http/presenters/catalog.presenter";

@Module({
	imports: [
		TypeOrmModule.forFeature([
			ModelOrmEntity,
			ProgramOrmEntity,
			LotOrmEntity,
			CenterOrmEntity,
			ProviderOrmEntity,
			SubProviderOrmEntity,
		]),
	],
	controllers: [CatalogController],
	providers: [
		// Mapper
		CatalogOrmMapper,

		// Repositories
		{ provide: MODEL_REPOSITORY, useClass: ModelTypeOrmRepository },
		{ provide: PROGRAM_REPOSITORY, useClass: ProgramTypeOrmRepository },
		{ provide: LOT_REPOSITORY, useClass: LotTypeOrmRepository },
		{ provide: CENTER_REPOSITORY, useClass: CenterTypeOrmRepository },
		{ provide: PROVIDER_REPOSITORY, useClass: ProviderTypeOrmRepository },
		{
			provide: SUB_PROVIDER_REPOSITORY,
			useClass: SubProviderTypeOrmRepository,
		},

		// Use Cases - Create
		CreateModelUseCase,
		CreateProgramUseCase,
		CreateLotUseCase,
		CreateCenterUseCase,
		CreateProviderUseCase,
		CreateSubProviderUseCase,

		// Use Cases - List
		ListModelsUseCase,
		ListProgramsUseCase,
		ListLotsUseCase,
		ListCentersUseCase,
		ListProvidersUseCase,
		ListSubProvidersUseCase,

		// Use Cases - GetById
		GetModelByIdUseCase,
		GetProgramByIdUseCase,
		GetLotByIdUseCase,
		GetCenterByIdUseCase,
		GetProviderByIdUseCase,
		GetSubProviderByIdUseCase,

		// Presenter
		CatalogPresenter,
	],
	exports: [
		// Export repositories for use in other modules (e.g., evaluation)
		MODEL_REPOSITORY,
		PROGRAM_REPOSITORY,
		LOT_REPOSITORY,
		CENTER_REPOSITORY,
		PROVIDER_REPOSITORY,
		SUB_PROVIDER_REPOSITORY,
	],
})
export class CatalogModule {}
