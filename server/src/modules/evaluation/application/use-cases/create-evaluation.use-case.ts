import { Inject, Injectable } from "@nestjs/common";
import type { ILogger } from "../../../upload/application/ports/logger.port";
import { LOGGER } from "../../../upload/application/ports/logger.port";
import type { ITransactionManager } from "../../../upload/application/ports/transaction-manager.port";
import { TRANSACTION_MANAGER } from "../../../upload/application/ports/transaction-manager.port";
import { CreateEvaluationInput } from "../dto/create-evaluation/create-evaluation.input";
import { CreateEvaluationOutput } from "../dto/create-evaluation/create-evaluation.output";
import type { ICreateEvaluationMapper } from "../mappers/create-evaluation.mapper.port";
import { CREATE_EVALUATION_MAPPER } from "../mappers/create-evaluation.mapper.port";
import type { IEvaluationRepository } from "../ports/repositories/evaluation.repository.port";
import { EVALUATION_REPOSITORY } from "../ports/repositories/evaluation.repository.port";

/**
 * Use case: Create Evaluation
 *
 * Creates a complete evaluation in a single transaction (one-shot flow).
 * The evaluation is immediately finalized upon creation.
 */
@Injectable()
export class CreateEvaluationUseCase {
	constructor(
		@Inject(EVALUATION_REPOSITORY)
		private readonly repository: IEvaluationRepository,
		@Inject(TRANSACTION_MANAGER)
		private readonly transactionManager: ITransactionManager,
		@Inject(LOGGER)
		private readonly logger: ILogger,
		@Inject(CREATE_EVALUATION_MAPPER)
		private readonly mapper: ICreateEvaluationMapper,
	) {}

	/**
	 * Execute the use case.
	 */
	async execute(input: CreateEvaluationInput): Promise<CreateEvaluationOutput> {
		this.logger.debug("CreateEvaluation: Starting", {
			id: input.id,
			type: input.type,
			stepsCount: input.steps?.length ?? 0,
		});

		return this.transactionManager.runInTransaction(async () => {
			// Map to domain aggregate (with finalization)
			const evaluation = this.mapper.toDomain(input);

			// Persist
			await this.repository.save(evaluation);

			// Map to output
			const output = this.mapper.toOutput(evaluation);

			this.logger.log("CreateEvaluation: Success", {
				id: output.id,
				totalSteps: output.totalSteps,
				totalPhotos: output.totalPhotos,
				totalSegments: output.totalSegments,
			});

			return output;
		});
	}
}
