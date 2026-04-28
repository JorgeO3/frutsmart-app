import { Inject, Injectable, BadRequestException } from "@nestjs/common";
import { isSecureUUIDv4 } from "@shared/validators";
import { UploadItem } from "../../domain/entities/upload-item.entity";
import { UploadSession } from "../../domain/entities/upload-session.entity";
import { UploadDomain } from "../../domain/types";
import { SessionNotFoundError } from "../errors/session-not-found.error";
import { CompleteSessionInput } from "../dto/complete-session/complete-session.input";
import {
	CompleteSessionOutput,
	ItemProcessingResultOutput,
} from "../dto/complete-session/complete-session.output";
import {
	type ICompleteSessionMapper,
	COMPLETE_SESSION_MAPPER,
} from "../mappers/complete-session.mapper";
import { type IBlobStorage, BLOB_STORAGE } from "../ports/blob-storage.port";
import { type ILogger, LOGGER } from "../ports/logger.port";
import {
	type IUploadSessionsRepository,
	UPLOAD_SESSIONS_REPOSITORY,
} from "../ports/repositories/upload-sessions.repo.port";
import {
	type ITransactionManager,
	TRANSACTION_MANAGER,
} from "../ports/transaction-manager.port";

@Injectable()
export class CompleteSessionUseCase {
	constructor(
		@Inject(LOGGER) private readonly logger: ILogger,
		@Inject(TRANSACTION_MANAGER)
		private readonly transactionManager: ITransactionManager,
		@Inject(UPLOAD_SESSIONS_REPOSITORY)
		private readonly sessionRepo: IUploadSessionsRepository,
		@Inject(BLOB_STORAGE) private readonly blobStorage: IBlobStorage,
		@Inject(COMPLETE_SESSION_MAPPER)
		private readonly mapper: ICompleteSessionMapper,
	) {}

	async execute(input: CompleteSessionInput): Promise<CompleteSessionOutput> {
		this.logExecutionStart(input);

		return this.transactionManager.runInTransaction(async () => {
			const session = await this.fetchSession(input.sessionId);
			session.guardCanGenerateSas();

			const itemsToProcess = this.selectItemsToProcess(
				session,
				input.onlyClientItemIds,
			);

			if (itemsToProcess.length === 0) {
				return this.handleEmptyProcessing(session, input);
			}

			this.logProcessing(
				input.sessionId,
				session.items.length,
				itemsToProcess.length,
			);

			const results = await this.processItems(
				itemsToProcess,
				session.domain,
				input,
			);
			this.finalizeSession(session, results, input.failOnIncomplete);

			await this.saveSessionWithRetry(session);
			this.logCompletion(session, results);

			return this.mapper.toOutput(session, results);
		});
	}

	// Carga y validación
	private async fetchSession(sessionId: string): Promise<UploadSession> {
		if (!isSecureUUIDv4(sessionId)) {
			throw new BadRequestException("Invalid session ID format");
		}

		const session = await this.sessionRepo.findById(sessionId);
		if (!session) {
			this.logger.warn("Session not found for completion", {
				sessionId,
				operation: "complete-session",
			});
			throw new SessionNotFoundError(sessionId);
		}

		return session;
	}

	private selectItemsToProcess(
		session: UploadSession,
		onlyClientItemIds?: readonly string[],
	): UploadItem[] {
		if (!onlyClientItemIds?.length) {
			return session.items as UploadItem[];
		}

		const clientIds = new Set(onlyClientItemIds);
		return (session.items as UploadItem[]).filter((item) =>
			clientIds.has(item.clientItemId.value),
		);
	}

	// Procesamiento de items
	private async processItems(
		items: UploadItem[],
		domain: UploadDomain,
		options: CompleteSessionInput,
	): Promise<ItemProcessingResultOutput[]> {
		return Promise.all(
			items.map((item) => this.processItem(item, domain, options)),
		);
	}

	private async processItem(
		item: UploadItem,
		domain: UploadDomain,
		options: CompleteSessionInput,
	): Promise<ItemProcessingResultOutput> {
		if (!options.verifyAndPromote) {
			return this.mapper.toItemResult(item);
		}

		try {
			await this.verifyItem(item, domain);
			this.logItemSuccess(item);
			return this.mapper.toItemResult(item);
		} catch (error) {
			this.logItemFailure(item, error as Error);
			if (item.status !== "FAILED") item.markAsFailed();
			return this.mapper.toItemResult(item, {
				code: "VERIFICATION_FAILED",
				message: (error as Error).message,
			});
		}
	}

	private async verifyItem(
		item: UploadItem,
		domain: UploadDomain,
	): Promise<void> {
		const metadata = await this.blobStorage.getObjectMetadata(
			item.location.blobName,
			domain,
		);

		if (!metadata.exists) throw new Error("Blob not found in storage");
		if (!metadata.md5Hash) throw new Error("MD5 not available for blob");

		if (item.canBeUploaded()) item.markAsUploaded();
		item.verify(metadata.md5Hash);
	}

	// Finalización
	private finalizeSession(
		session: UploadSession,
		_results: ItemProcessingResultOutput[],
		failOnIncomplete: boolean,
	): void {
		try {
			session.complete();
		} catch (error) {
			this.logger.warn("Session completion failed", {
				sessionId: session.id,
				error: (error as Error).message,
			});
			if (failOnIncomplete) {
				session.fail();
			}
		}
	}

	private async saveSessionWithRetry(session: UploadSession): Promise<void> {
		try {
			await this.sessionRepo.save(session);
			// TODO: use a more specific error type here
			// biome-ignore lint/suspicious/noExplicitAny: this is needed for DB error handling
		} catch (error: any) {
			if (error?.code === "23514") {
				this.logger.warn(
					"DB prevented COMPLETE due to non-verified items. Marking FAILED.",
					{
						sessionId: session.id,
					},
				);
				session.fail();
				await this.sessionRepo.save(session);
			} else {
				throw error;
			}
		}
	}

	// Manejo de casos especiales
	private async handleEmptyProcessing(
		session: UploadSession,
		input: CompleteSessionInput,
	): Promise<CompleteSessionOutput> {
		this.logger.warn("No items to process in complete session", {
			sessionId: input.sessionId,
			totalItems: session.items.length,
			requestedFilter: input.onlyClientItemIds?.length,
		});

		if (input.failOnIncomplete) {
			session.fail();
			await this.sessionRepo.save(session);
		}

		return this.mapper.toOutput(session, []);
	}

	// Logging
	private logExecutionStart(input: CompleteSessionInput): void {
		this.logger.debug("Completing session", {
			sessionId: input.sessionId,
			verifyAndPromote: input.verifyAndPromote,
			failOnIncomplete: input.failOnIncomplete,
			itemFilter: input.onlyClientItemIds?.length ? "filtered" : "all",
		});
	}

	private logProcessing(
		sessionId: string,
		totalItems: number,
		itemsToProcess: number,
	): void {
		this.logger.debug("Processing items", {
			sessionId,
			totalItems,
			itemsToProcess,
		});
	}

	private logItemSuccess(item: UploadItem): void {
		this.logger.debug("Item verified successfully", {
			itemId: item.id,
			clientItemId: item.clientItemId.value,
			blobName: item.location.blobName,
			status: item.status,
		});
	}

	private logItemFailure(item: UploadItem, error: Error): void {
		this.logger.error("Item verification failed", error.stack, {
			itemId: item.id,
			clientItemId: item.clientItemId.value,
			blobName: item.location.blobName,
			initialStatus: item.status,
			errorMessage: error.message,
		});
	}

	private logCompletion(
		session: UploadSession,
		results: ItemProcessingResultOutput[],
	): void {
		const summary = this.calculateResultsSummary(results);
		this.logger.log("Session completed", {
			sessionId: session.id,
			finalStatus: session.status,
			...summary,
		});
	}

	// Utilidades
	private calculateResultsSummary(results: ItemProcessingResultOutput[]): {
		totalItems: number;
		failedCount: number;
		uploadedCount: number;
	} {
		const isSuccess = (status: string) =>
			status === "VERIFIED" || status === "UPLOADED";
		return {
			totalItems: results.length,
			failedCount: results.filter((r) => r.finalStatus === "FAILED").length,
			uploadedCount: results.filter((r) => isSuccess(r.finalStatus)).length,
		};
	}
}
