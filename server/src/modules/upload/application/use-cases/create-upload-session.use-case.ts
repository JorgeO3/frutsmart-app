import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { ClientIdentifier } from "../../domain/value-objects/client-identifier.vo";
import { type ILogger, LOGGER } from "../ports/logger.port";
import {
	type IUploadSessionsRepository,
	UPLOAD_SESSIONS_REPOSITORY,
} from "../ports/repositories/upload-sessions.repo.port";
import {
	type ITransactionManager,
	TRANSACTION_MANAGER,
} from "../ports/transaction-manager.port";
import { CreateUploadSessionInput } from "../dto/create-upload-session/create-upload-session.input";
import { CreateUploadSessionOutput } from "../dto/create-upload-session/create-upload-session.output";
import {
	type ICreateUploadSessionMapper,
	CREATE_UPLOAD_SESSION_MAPPER,
} from "../mappers/create-upload-session.mapper";

@Injectable()
export class CreateUploadSessionUseCase {
	constructor(
		@Inject(LOGGER) private readonly logger: ILogger,
		@Inject(TRANSACTION_MANAGER)
		private readonly transactionManager: ITransactionManager,
		@Inject(UPLOAD_SESSIONS_REPOSITORY)
		private readonly sessionRepo: IUploadSessionsRepository,
		@Inject(CREATE_UPLOAD_SESSION_MAPPER)
		private readonly mapper: ICreateUploadSessionMapper,
	) {}

	async execute(
		input: CreateUploadSessionInput,
	): Promise<CreateUploadSessionOutput> {
		const startedAt = Date.now();
		this.logger.debug("Creating upload session", {
			clientBatchId: input.clientBatchId,
			fileCount: input.files.length,
			domain: input.domain,
		});

		// Defensa en profundidad
		const clientBatchId = ClientIdentifier.create(input.clientBatchId);

		const MAX = 2000;
		if (input.files.length > MAX) {
			throw new BadRequestException(
				`Too many files: ${input.files.length} > ${MAX}`,
			);
		}

		const existingSession =
			await this.sessionRepo.findOpenByClientBatchId(clientBatchId);
		if (existingSession) {
			this.logger.log("Reusing existing open session", {
				sessionId: existingSession.id,
				clientBatchId: input.clientBatchId,
				existingItemCount: existingSession.items.length,
				durationMs: Date.now() - startedAt,
			});
			return this.mapper.toOutput(
				existingSession /*, { idempotency: 'reused' }*/,
			);
		}

		return this.transactionManager.runInTransaction(async () => {
			try {
				const newSession = this.mapper.toDomain(input /* o con dedupedFiles */);
				await this.sessionRepo.save(newSession);
				this.logger.log("Upload session created successfully", {
					sessionId: newSession.id,
					clientBatchId: input.clientBatchId,
					itemCount: newSession.items.length,
					domain: newSession.domain,
					durationMs: Date.now() - startedAt,
				});
				return this.mapper.toOutput(newSession); // { idempotency: 'created' }
			} catch (err: unknown) {
				if (this.sessionRepo.isUniqueViolation(err)) {
					const reused =
						await this.sessionRepo.findOpenByClientBatchId(clientBatchId);
					if (reused) {
						this.logger.log(
							"Reusing existing open session after unique violation",
							{
								sessionId: reused.id,
								clientBatchId: input.clientBatchId,
								durationMs: Date.now() - startedAt,
							},
						);
						return this.mapper.toOutput(reused);
					}
				}

				this.logger.error(
					"Upload session creation failed",
					/* stack */ undefined,
					{
						clientBatchId: input.clientBatchId,
						durationMs: Date.now() - startedAt,
					},
				);

				throw err;
			}
		});
	}
}
