import { Inject, Injectable } from "@nestjs/common";
import { BadRequestException } from "@nestjs/common";
import { isSecureUUIDv4 } from "@shared/validators";
import { type ILogger, LOGGER } from "../ports/logger.port";
import { ItemNotFoundError } from "../errors/item-not-found.error";
import { SessionNotFoundError } from "../errors/session-not-found.error";
import { UploadSession } from "../../domain/entities/upload-session.entity";
import {
	type IRefreshSasBatchMapper,
	REFRESH_SAS_BATCH_MAPPER,
} from "../mappers/refresh-sas-batch.mapper";
import { RefreshSasBatchInput } from "../dto/refresh-sas-batch/refresh-sas-batch.input";
import { RefreshSasBatchOutput } from "../dto/refresh-sas-batch/refresh-sas-batch.output";
import {
	BLOB_STORAGE,
	type IBlobStorage,
	type SignedUrlRequest,
} from "../ports/blob-storage.port";
import {
	type IUploadSessionsRepository,
	UPLOAD_SESSIONS_REPOSITORY,
} from "../ports/repositories/upload-sessions.repo.port";
import { SAS_CONFIG } from "../constants/sas-config.constants";

@Injectable()
export class RefreshSasBatchUseCase {
	constructor(
		@Inject(LOGGER) private readonly logger: ILogger,
		@Inject(UPLOAD_SESSIONS_REPOSITORY)
		private readonly sessionRepo: IUploadSessionsRepository,
		@Inject(BLOB_STORAGE) private readonly blobStorage: IBlobStorage,
		@Inject(REFRESH_SAS_BATCH_MAPPER)
		private readonly mapper: IRefreshSasBatchMapper,
	) {}

	async execute(input: RefreshSasBatchInput): Promise<RefreshSasBatchOutput> {
		this.logger.debug("Refreshing SAS batch", {
			sessionId: input.sessionId,
			itemCount: input.items.length,
		});

		const session = await this.fetchAndValidateSession(input.sessionId);

		// Deduplication by objectKey
		const uniqueItems = Array.from(
			new Map(input.items.map((i) => [i.objectKey, i])).values(),
		);

		if (uniqueItems.length < input.items.length) {
			this.logger.debug("Deduplicated items in refresh SAS batch request", {
				sessionId: input.sessionId,
				originalCount: input.items.length,
				uniqueCount: uniqueItems.length,
			});
		}

		// Early return for empty items
		if (uniqueItems.length === 0) {
			this.logger.debug("No items to refresh SAS tokens for", {
				sessionId: input.sessionId,
			});
			return this.mapper.toOutput([]);
		}

		// Batch size validation
		const MAX_ITEMS = SAS_CONFIG.MAX_ITEMS_PER_REQUEST;
		if (uniqueItems.length > MAX_ITEMS) {
			this.logger.warn("Refresh SAS batch size exceeds maximum", {
				sessionId: input.sessionId,
				requestedCount: uniqueItems.length,
				maxAllowed: MAX_ITEMS,
			});
			throw new BadRequestException(
				`Too many items in batch: ${uniqueItems.length} exceeds maximum of ${MAX_ITEMS}`,
			);
		}

		const requests = this.buildStorageRequests(session, uniqueItems);

		const signedUrls = await this.blobStorage.generateUploadUrls(
			requests,
			SAS_CONFIG.DEFAULT_TTL_MINUTES,
		);

		this.logger.log("SAS tokens refreshed successfully", {
			sessionId: input.sessionId,
			tokenCount: signedUrls.length,
			ttlMinutes: SAS_CONFIG.DEFAULT_TTL_MINUTES,
			domain: session.domain,
		});

		return this.mapper.toOutput(signedUrls);
	}

	private async fetchAndValidateSession(
		sessionId: string,
	): Promise<UploadSession> {
		if (!isSecureUUIDv4(sessionId)) {
			throw new BadRequestException("Invalid session ID format");
		}

		const session = await this.sessionRepo.findById(sessionId);

		if (!session) {
			this.logger.warn("Session not found for SAS refresh", {
				sessionId,
				operation: "refresh-sas-batch",
			});
			throw new SessionNotFoundError(sessionId);
		}

		session.guardCanGenerateSas();
		return session;
	}

	private buildStorageRequests(
		session: UploadSession,
		items: RefreshSasBatchInput["items"],
	): SignedUrlRequest[] {
		return items.map((item) => this.buildStorageRequest(session, item));
	}

	private buildStorageRequest(
		session: UploadSession,
		item: RefreshSasBatchInput["items"][number],
	): SignedUrlRequest {
		const sessionItem = session.findItemByBlobName(item.objectKey);

		if (!sessionItem) {
			throw new ItemNotFoundError(item.objectKey, session.id);
		}

		return {
			domain: session.domain,
			objectKey: item.objectKey,
			contentType: item.contentType,
		};
	}
}
