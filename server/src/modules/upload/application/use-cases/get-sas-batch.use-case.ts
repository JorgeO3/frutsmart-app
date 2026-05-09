import { Inject, Injectable, BadRequestException } from "@nestjs/common";
import { isSecureUUIDv4 } from "@shared/validators";
import { type ILogger, LOGGER } from "../ports/logger.port";
import { ItemNotFoundError } from "../errors/item-not-found.error";
import {
	type IGetSasBatchMapper,
	GET_SAS_BATCH_MAPPER,
} from "../mappers/get-sas-batch.mapper";
import { SessionNotFoundError } from "../errors/session-not-found.error";
import { GetSasBatchInput } from "../dto/get-sas-batch/get-sas-batch.input";
import { UploadSession } from "../../domain/entities/upload-session.entity";
import { GetSasBatchOutput } from "../dto/get-sas-batch/get-sas-batch.output";
import {
	BLOB_STORAGE,
	type IBlobStorage,
} from "../ports/blob-storage.port";
import {
	type IUploadSessionsRepository,
	UPLOAD_SESSIONS_REPOSITORY,
} from "../ports/repositories/upload-sessions.repo.port";
import { SAS_CONFIG } from "../constants/sas-config.constants";

@Injectable()
export class GetSasBatchUseCase {
	constructor(
		@Inject(LOGGER) private readonly logger: ILogger,
		@Inject(UPLOAD_SESSIONS_REPOSITORY)
		private readonly sessionRepo: IUploadSessionsRepository,
		@Inject(BLOB_STORAGE) private readonly blobStorage: IBlobStorage,
		@Inject(GET_SAS_BATCH_MAPPER) private readonly mapper: IGetSasBatchMapper,
	) {}

	async execute(input: GetSasBatchInput): Promise<GetSasBatchOutput> {
		this.logger.debug("Generating SAS batch", {
			sessionId: input.sessionId,
			itemCount: input.items.length,
			ttlMinutes: input.ttlMinutes,
		});

		// 0) Deduplicate por objectKey
		const uniqueItems = Array.from(
			new Map(input.items.map((i) => [i.objectKey, i])).values(),
		);
		if (uniqueItems.length < input.items.length) {
			this.logger.debug("Deduplicated items in SAS batch request", {
				originalCount: input.items.length,
				uniqueCount: uniqueItems.length,
			});
		}

		// 1) Early returns y límites
		if (uniqueItems.length === 0) {
			this.logger.debug("No items to generate SAS tokens for", {
				sessionId: input.sessionId,
			});
			return this.mapper.toOutput([]);
		}

		if (uniqueItems.length > SAS_CONFIG.MAX_ITEMS_PER_REQUEST) {
			throw new BadRequestException(
				`Too many items in batch: ${uniqueItems.length} exceeds maximum of ${SAS_CONFIG.MAX_ITEMS_PER_REQUEST}`,
			);
		}

		// 2) Sesión válida y OPEN
		const session = await this.fetchAndValidateSession(input.sessionId);

		// 3) Validar que TODOS los items existan en la sesión (COUNT, sin cargar el agregado)
		const blobNames = uniqueItems.map((i) => i.objectKey);
		const itemCount = await this.sessionRepo.countItemsInSession(
			session.id,
			blobNames,
		);
		if (itemCount < blobNames.length) {
			// Encontrar cuál falta (poco frecuente, se hace con los datos en memoria de session)
			for (const it of uniqueItems) {
				const exists = session.items.some(
					(sItem) => sItem.location.blobName === it.objectKey,
				);
				if (!exists) {
					throw new ItemNotFoundError(it.objectKey, session.id);
				}
			}
		}

		// 4) Marcar IN_PROGRESS de forma atómica (UPDATE dirigido, sin cascade)
		const updated = await this.sessionRepo.markItemsAsInProgress(
			session.id,
			blobNames,
		);
		if (updated > 0) {
			this.logger.debug("Marked items as IN_PROGRESS prior to SAS generation", {
				sessionId: session.id,
				touched: updated,
			});
		}

		// 5) Preparar requests y normalizar TTL
		const requests = uniqueItems.map((it) => ({
			domain: session.domain,
			objectKey: it.objectKey,
			contentType: it.contentType,
		}));
		const rawTtl = input.ttlMinutes ?? SAS_CONFIG.DEFAULT_TTL_MINUTES;
		const ttl = Math.max(
			SAS_CONFIG.MIN_TTL_MINUTES,
			Math.min(rawTtl, SAS_CONFIG.MAX_TTL_MINUTES),
		);
		if (ttl !== rawTtl) {
			this.logger.debug("TTL clamped to valid range", {
				requested: rawTtl,
				actual: ttl,
			});
		}

		// 6) Generar SAS
		const signedUrls = await this.blobStorage.generateUploadUrls(requests, ttl);

		this.logger.log("SAS tokens generated successfully", {
			sessionId: input.sessionId,
			tokenCount: signedUrls.length,
			ttlMinutes: ttl,
			domain: session.domain,
		});

		return this.mapper.toOutput(signedUrls);
	}

	// ---------------------------------------------------------------------------
	// Helpers
	// ---------------------------------------------------------------------------

	private async fetchAndValidateSession(
		sessionId: string,
	): Promise<UploadSession> {
		if (!isSecureUUIDv4(sessionId)) {
			throw new BadRequestException(
				"Invalid session ID format, must be a secure UUID v4",
			);
		}

		const session = await this.sessionRepo.findById(sessionId);
		if (!session) {
			this.logger.warn("Session not found for SAS generation", {
				sessionId,
				operation: "get-sas-batch",
			});
			throw new SessionNotFoundError(sessionId);
		}

		session.guardCanGenerateSas();
		return session;
	}
}
