import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UuidGeneratorAdapter } from "./infrastructure/providers/uuid-generator.adapter";

// Controllers
import { UploadController } from "./interface/http/controllers/upload.controller";

// HTTP Layer (Presenters & Mappers)
import { CREATE_UPLOAD_SESSION_PRESENTER } from "./interface/http/presenters/create-upload-session.presenter.port";
import { CreateUploadSessionPresenter } from "./interface/http/presenters/create-upload-session.presenter";
import { COMPLETE_SESSION_PRESENTER } from "./interface/http/presenters/complete-session.presenter.port";
import { CompleteSessionPresenter } from "./interface/http/presenters/complete-session.presenter";
import { GET_SAS_BATCH_PRESENTER } from "./interface/http/presenters/get-sas-batch.presenter.port";
import { GetSasBatchPresenter } from "./interface/http/presenters/get-sas-batch.presenter";
import { REFRESH_SAS_BATCH_PRESENTER } from "./interface/http/presenters/refresh-sas-batch.presenter.port";
import { RefreshSasBatchPresenter } from "./interface/http/presenters/refresh-sas-batch.presenter";
import { CREATE_UPLOAD_SESSION_HTTP_MAPPER } from "./interface/http/mappers/create-upload-session.mapper.port";
import { CreateUploadSessionHttpMapper } from "./interface/http/mappers/create-upload-session.mapper";
import { GET_SAS_BATCH_HTTP_MAPPER } from "./interface/http/mappers/get-sas-batch.mapper.port";
import { GetSasBatchHttpMapper } from "./interface/http/mappers/get-sas-batch.mapper";
import { REFRESH_SAS_BATCH_HTTP_MAPPER } from "./interface/http/mappers/refresh-sas-batch.mapper.port";
import { RefreshSasBatchHttpMapper } from "./interface/http/mappers/refresh-sas-batch.mapper";
import { COMPLETE_SESSION_HTTP_MAPPER } from "./interface/http/mappers/complete-session.mapper.port";
import { CompleteSessionHttpMapper } from "./interface/http/mappers/complete-session.mapper";

// Application Layer (Use Cases & Mappers)
import { CreateUploadSessionUseCase } from "./application/use-cases/create-upload-session.use-case";
import { CompleteSessionUseCase } from "./application/use-cases/complete-session.use-case";
import { GetSasBatchUseCase } from "./application/use-cases/get-sas-batch.use-case";
import { RefreshSasBatchUseCase } from "./application/use-cases/refresh-sas-batch.use-case";
import {
	CreateUploadSessionMapper,
	CREATE_UPLOAD_SESSION_MAPPER,
} from "./application/mappers/create-upload-session.mapper";
import {
	CompleteSessionMapper,
	COMPLETE_SESSION_MAPPER,
} from "./application/mappers/complete-session.mapper";
import {
	GetSasBatchMapper,
	GET_SAS_BATCH_MAPPER,
} from "./application/mappers/get-sas-batch.mapper";
import {
	RefreshSasBatchMapper,
	REFRESH_SAS_BATCH_MAPPER,
} from "./application/mappers/refresh-sas-batch.mapper";

// Application Ports
import { UUID_GENERATOR } from "./application/ports/uuid-generator.port";
import { LOGGER } from "./application/ports/logger.port";
import { BLOB_STORAGE } from "./application/ports/blob-storage.port";
import { TRANSACTION_MANAGER } from "./application/ports/transaction-manager.port";
import { UPLOAD_SESSIONS_REPOSITORY } from "./application/ports/repositories/upload-sessions.repo.port";

// Infrastructure Layer
import { UploadSessionEntity } from "./infrastructure/persistence/entities/upload-session.orm-entity";
import { UploadItemEntity } from "./infrastructure/persistence/entities/upload-item.orm-entity";
import { AzureBlobStorageAdapter } from "./infrastructure/integrations/azure/azure-blob-storage.adapter";
import { PinoLoggerAdapter } from "./infrastructure/logging/pino-logger.adapter";
import { TypeOrmTransactionManager } from "./infrastructure/persistence/adapters/typeorm-transaction-manager.adapter";
import { UploadSessionsRepositoryAdapter } from "./infrastructure/persistence/adapters/upload-sessions-repository.adapter";
import { UPLOAD_SESSION_ORM_MAPPER } from "./infrastructure/persistence/mappers/upload-session-orm.mapper.port";
import { UploadSessionOrmMapper } from "./infrastructure/persistence/mappers/upload-session-orm.mapper";
import { UploadSessionsRepo } from "./infrastructure/persistence/repositories/upload-sessions.typeorm-repo";

// External Modules
import { AzureBlobModule } from "../../platform/integrations/azure/azure-blob.module";

// biome-ignore format: true
@Module({
	imports: [
		TypeOrmModule.forFeature([UploadSessionEntity, UploadItemEntity]),
		AzureBlobModule,
	],
	controllers: [UploadController],
	providers: [
		// HTTP Layer - Presenters
		{ provide: CREATE_UPLOAD_SESSION_PRESENTER, useClass: CreateUploadSessionPresenter },
		{ provide: COMPLETE_SESSION_PRESENTER, useClass: CompleteSessionPresenter },
		{ provide: GET_SAS_BATCH_PRESENTER, useClass: GetSasBatchPresenter },
		{ provide: REFRESH_SAS_BATCH_PRESENTER, useClass: RefreshSasBatchPresenter },

		// HTTP Layer - Mappers
		{ provide: CREATE_UPLOAD_SESSION_HTTP_MAPPER, useClass: CreateUploadSessionHttpMapper },
		{ provide: GET_SAS_BATCH_HTTP_MAPPER, useClass: GetSasBatchHttpMapper },
		{ provide: REFRESH_SAS_BATCH_HTTP_MAPPER, useClass: RefreshSasBatchHttpMapper },
		{ provide: COMPLETE_SESSION_HTTP_MAPPER, useClass: CompleteSessionHttpMapper },

		// Application Layer - Use Cases
		CreateUploadSessionUseCase,
		CompleteSessionUseCase,
		GetSasBatchUseCase,
		RefreshSasBatchUseCase,
    
		// Application Layer - Mappers
		{ provide: CREATE_UPLOAD_SESSION_MAPPER, useClass: CreateUploadSessionMapper },
		{ provide: COMPLETE_SESSION_MAPPER, useClass: CompleteSessionMapper },
		{ provide: GET_SAS_BATCH_MAPPER, useClass: GetSasBatchMapper },
		{ provide: REFRESH_SAS_BATCH_MAPPER, useClass: RefreshSasBatchMapper },

		// Infrastructure - Mappers
		{ provide: UPLOAD_SESSION_ORM_MAPPER, useClass: UploadSessionOrmMapper },

		// Infrastructure - Port Implementations
		{ provide: UUID_GENERATOR, useClass: UuidGeneratorAdapter },
		{ provide: LOGGER, useClass: PinoLoggerAdapter },
		{ provide: BLOB_STORAGE, useClass: AzureBlobStorageAdapter },
		{ provide: TRANSACTION_MANAGER, useClass: TypeOrmTransactionManager },
		{ provide: UPLOAD_SESSIONS_REPOSITORY, useClass: UploadSessionsRepositoryAdapter },

		// Infrastructure - TypeORM Repos (internal use only)
		UploadSessionsRepo,
	],
})
export class UploadModule {}
