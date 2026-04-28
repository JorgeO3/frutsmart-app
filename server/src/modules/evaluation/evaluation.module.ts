import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { EVALUATION_REPOSITORY } from "./application/ports/repositories/evaluation.repository.port";
import { CREATE_EVALUATION_MAPPER } from "./application/mappers/create-evaluation.mapper.port";
import { CreateEvaluationMapper } from "./application/mappers/create-evaluation.mapper";
import { CreateEvaluationUseCase } from "./application/use-cases/create-evaluation.use-case";
import { ClassificationResultOrmEntity } from "./infrastructure/persistence/entities/classification-result.orm-entity";
import { ClassificationStepOrmEntity } from "./infrastructure/persistence/entities/classification-step.orm-entity";
import { ClassifiedSegmentOrmEntity } from "./infrastructure/persistence/entities/classified-segment.orm-entity";
import { EvaluationOrmEntity } from "./infrastructure/persistence/entities/evaluation.orm-entity";
import { PhotoOrmEntity } from "./infrastructure/persistence/entities/photo.orm-entity";
import { EvaluationRepositoryAdapter } from "./infrastructure/persistence/adapters/evaluation.repository.adapter";
import { EVALUATION_ORM_MAPPER } from "./infrastructure/persistence/mappers/evaluation-orm.mapper.port";
import { EvaluationOrmMapper } from "./infrastructure/persistence/mappers/evaluation-orm.mapper";
import { EvaluationController } from "./interface/http/controllers/evaluation.controller";
import { CREATE_EVALUATION_PRESENTER } from "./interface/http/presenters/create-evaluation.presenter.port";
import { CreateEvaluationPresenter } from "./interface/http/presenters/create-evaluation.presenter";
import { UUID_GENERATOR } from "./application/ports/uuid-generator.port";
import { UuidGeneratorAdapter } from "./infrastructure/providers/uuid-generator.adapter";
import { LOGGER } from "./application/ports/logger.port";
import { PinoLoggerAdapter } from "./infrastructure/logging/pino-logger.adapter";
import { TRANSACTION_MANAGER } from "./application/ports/transaction-manager.port";
import { TypeOrmTransactionManager } from "./infrastructure/persistence/adapters/typeorm-transaction-manager.adapter";

/**
 * Evaluation Module
 *
 * Implements the evaluation domain following Clean Architecture and DDD principles.
 * Provides a single endpoint: POST /evaluations (one-shot creation).
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([
			EvaluationOrmEntity,
			ClassificationStepOrmEntity,
			ClassificationResultOrmEntity,
			PhotoOrmEntity,
			ClassifiedSegmentOrmEntity,
		]),
	],
	controllers: [EvaluationController],
	providers: [
		// Application layer
		CreateEvaluationUseCase,
		{ provide: CREATE_EVALUATION_MAPPER, useClass: CreateEvaluationMapper },

		// Infrastructure layer
		{ provide: EVALUATION_ORM_MAPPER, useClass: EvaluationOrmMapper },
		{ provide: EVALUATION_REPOSITORY, useClass: EvaluationRepositoryAdapter },

		// Port Implementations
		{ provide: UUID_GENERATOR, useClass: UuidGeneratorAdapter },
		{ provide: LOGGER, useClass: PinoLoggerAdapter },
		{ provide: TRANSACTION_MANAGER, useClass: TypeOrmTransactionManager },

		// Interface layer
		{
			provide: CREATE_EVALUATION_PRESENTER,
			useClass: CreateEvaluationPresenter,
		},
	],
	exports: [],
})
export class EvaluationModule {}
