import {
	Body,
	Controller,
	Inject,
	Param,
	ParseUUIDPipe,
	Post,
	UseGuards,
} from "@nestjs/common";
import {
	ApiBadRequestResponse,
	ApiBearerAuth,
	ApiCreatedResponse,
	ApiNotFoundResponse,
	ApiOkResponse,
	ApiOperation,
	ApiTags,
	ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { CreateUploadSessionUseCase } from "../../../application/use-cases/create-upload-session.use-case";
import { CompleteSessionUseCase } from "../../../application/use-cases/complete-session.use-case";
import { GetSasBatchUseCase } from "../../../application/use-cases/get-sas-batch.use-case";
import { RefreshSasBatchUseCase } from "../../../application/use-cases/refresh-sas-batch.use-case";
import type { ICreateUploadSessionPresenter } from "../presenters/create-upload-session.presenter.port";
import { CREATE_UPLOAD_SESSION_PRESENTER } from "../presenters/create-upload-session.presenter.port";
import type { ICompleteSessionPresenter } from "../presenters/complete-session.presenter.port";
import { COMPLETE_SESSION_PRESENTER } from "../presenters/complete-session.presenter.port";
import type { IGetSasBatchPresenter } from "../presenters/get-sas-batch.presenter.port";
import { GET_SAS_BATCH_PRESENTER } from "../presenters/get-sas-batch.presenter.port";
import type { IRefreshSasBatchPresenter } from "../presenters/refresh-sas-batch.presenter.port";
import { REFRESH_SAS_BATCH_PRESENTER } from "../presenters/refresh-sas-batch.presenter.port";
import type { ICreateUploadSessionHttpMapper } from "../mappers/create-upload-session.mapper.port";
import { CREATE_UPLOAD_SESSION_HTTP_MAPPER } from "../mappers/create-upload-session.mapper.port";
import type { IGetSasBatchHttpMapper } from "../mappers/get-sas-batch.mapper.port";
import { GET_SAS_BATCH_HTTP_MAPPER } from "../mappers/get-sas-batch.mapper.port";
import type { IRefreshSasBatchHttpMapper } from "../mappers/refresh-sas-batch.mapper.port";
import { REFRESH_SAS_BATCH_HTTP_MAPPER } from "../mappers/refresh-sas-batch.mapper.port";
import type { ICompleteSessionHttpMapper } from "../mappers/complete-session.mapper.port";
import { COMPLETE_SESSION_HTTP_MAPPER } from "../mappers/complete-session.mapper.port";
import { CreateUploadSessionDto } from "../dto/requests/create-upload-session.dto";
import { CompleteSessionDto } from "../dto/requests/complete-session.dto";
import { GetSasBatchRequestDto } from "../dto/requests/get-sas-batch.dto";
import { RefreshSasBatchDto } from "../dto/requests/refresh-sas-batch.dto";
import { CreateUploadSessionResponse } from "../dto/responses/create-upload-session.response";
import { CompleteSessionResponse } from "../dto/responses/complete-session.response";
import { GetSasBatchResponse } from "../dto/responses/get-sas-batch.response";
import { RefreshSasBatchResponse } from "../dto/responses/refresh-sas.response";
import { ApiKeyGuard } from "@platform/http/guards/api-key.guard";

/**
 * Controller for upload session management.
 * Handles session creation, SAS token generation, and session completion.
 */
@ApiTags("upload")
@Controller("upload")
@UseGuards(ApiKeyGuard)
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: "Invalid or missing API key" })
export class UploadController {
	constructor(
		private readonly createSessionUseCase: CreateUploadSessionUseCase,
		private readonly completeSessionUseCase: CompleteSessionUseCase,
		private readonly getSasBatchUseCase: GetSasBatchUseCase,
		private readonly refreshSasBatchUseCase: RefreshSasBatchUseCase,
		@Inject(CREATE_UPLOAD_SESSION_PRESENTER)
		private readonly createSessionPresenter: ICreateUploadSessionPresenter,
		@Inject(COMPLETE_SESSION_PRESENTER)
		private readonly completeSessionPresenter: ICompleteSessionPresenter,
		@Inject(GET_SAS_BATCH_PRESENTER)
		private readonly getSasBatchPresenter: IGetSasBatchPresenter,
		@Inject(REFRESH_SAS_BATCH_PRESENTER)
		private readonly refreshSasBatchPresenter: IRefreshSasBatchPresenter,
		@Inject(CREATE_UPLOAD_SESSION_HTTP_MAPPER)
		private readonly createSessionMapper: ICreateUploadSessionHttpMapper,
		@Inject(GET_SAS_BATCH_HTTP_MAPPER)
		private readonly getSasBatchMapper: IGetSasBatchHttpMapper,
		@Inject(REFRESH_SAS_BATCH_HTTP_MAPPER)
		private readonly refreshSasBatchMapper: IRefreshSasBatchHttpMapper,
		@Inject(COMPLETE_SESSION_HTTP_MAPPER)
		private readonly completeSessionMapper: ICompleteSessionHttpMapper,
	) {}

	/**
	 * Creates a new upload session for a batch of files.
	 * Returns session metadata and pre-configured blob paths for each file.
	 */
	@Post("sessions")
	@ApiOperation({
		summary: "Create upload session",
		description:
			"Initializes a new upload session with file metadata. Returns session ID and blob paths.",
	})
	@ApiCreatedResponse({
		description: "Upload session created successfully",
		type: CreateUploadSessionResponse,
	})
	@ApiBadRequestResponse({ description: "Invalid request data" })
	async createSession(
		@Body() dto: CreateUploadSessionDto,
	): Promise<CreateUploadSessionResponse> {
		const input = this.createSessionMapper.toInput(dto);
		const output = await this.createSessionUseCase.execute(input);
		return this.createSessionPresenter.toResponse(output);
	}

	/**
	 * Generates SAS tokens for batch upload to Azure Blob Storage.
	 */
	@Post("sessions/:sessionId/sas-batch")
	@ApiOperation({
		summary: "Generate SAS tokens batch",
		description:
			"Generates time-limited signed URLs for direct client-to-storage uploads.",
	})
	@ApiOkResponse({
		description: "SAS tokens generated successfully",
		type: GetSasBatchResponse,
	})
	@ApiNotFoundResponse({ description: "Session not found" })
	@ApiBadRequestResponse({ description: "Invalid request data" })
	async getSasBatch(
		@Param("sessionId", new ParseUUIDPipe({ version: "4" })) sessionId: string,
		@Body() dto: GetSasBatchRequestDto,
	): Promise<GetSasBatchResponse> {
		const input = this.getSasBatchMapper.toInput(sessionId, dto);
		const output = await this.getSasBatchUseCase.execute(input);
		return this.getSasBatchPresenter.toResponse(output);
	}

	/**
	 * Refreshes expired SAS tokens for ongoing uploads.
	 */
	@Post("sessions/:sessionId/sas/refresh")
	@ApiOperation({
		summary: "Refresh SAS tokens",
		description: "Generates new signed URLs for items with expired tokens.",
	})
	@ApiOkResponse({
		description: "SAS tokens refreshed successfully",
		type: RefreshSasBatchResponse,
	})
	@ApiNotFoundResponse({ description: "Session not found" })
	@ApiBadRequestResponse({ description: "Invalid request data" })
	async refreshSasBatch(
		@Param("sessionId", new ParseUUIDPipe({ version: "4" })) sessionId: string,
		@Body() dto: RefreshSasBatchDto,
	): Promise<RefreshSasBatchResponse> {
		const input = this.refreshSasBatchMapper.toInput(sessionId, dto);
		const output = await this.refreshSasBatchUseCase.execute(input);
		return this.refreshSasBatchPresenter.toResponse(output);
	}

	/**
	 * Completes an upload session after all files have been uploaded.
	 * Optionally verifies file integrity and promotes files to final storage.
	 */
	@Post("sessions/:sessionId/complete")
	@ApiOperation({
		summary: "Complete upload session",
		description:
			"Finalizes the session, optionally verifying integrity and promoting files.",
	})
	@ApiOkResponse({
		description: "Session completed successfully",
		type: CompleteSessionResponse,
	})
	@ApiNotFoundResponse({ description: "Session not found" })
	@ApiBadRequestResponse({ description: "Invalid request data" })
	async completeSession(
		@Param("sessionId", new ParseUUIDPipe({ version: "4" })) sessionId: string,
		@Body() dto: CompleteSessionDto,
	): Promise<CompleteSessionResponse> {
		const input = this.completeSessionMapper.toInput(sessionId, dto);
		const output = await this.completeSessionUseCase.execute(input);
		return this.completeSessionPresenter.toResponse(output);
	}
}
