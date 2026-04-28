import {
	Body,
	Controller,
	Get,
	HttpCode,
	Param,
	ParseUUIDPipe,
	Post,
	Query,
} from "@nestjs/common";
import {
	ApiBearerAuth,
	ApiOperation,
	ApiQuery,
	ApiResponse,
	ApiSecurity,
	ApiTags,
} from "@nestjs/swagger";
import { CreateModelUseCase } from "../../../application/use-cases/create-model.use-case";
import { CreateProgramUseCase } from "../../../application/use-cases/create-program.use-case";
import { CreateLotUseCase } from "../../../application/use-cases/create-lot.use-case";
import { CreateCenterUseCase } from "../../../application/use-cases/create-center.use-case";
import { CreateProviderUseCase } from "../../../application/use-cases/create-provider.use-case";
import { CreateSubProviderUseCase } from "../../../application/use-cases/create-sub-provider.use-case";
import {
	ListModelsUseCase,
	ListProgramsUseCase,
	ListLotsUseCase,
	ListCentersUseCase,
	ListProvidersUseCase,
	ListSubProvidersUseCase,
} from "../../../application/use-cases/list.use-cases";
import {
	GetModelByIdUseCase,
	GetProgramByIdUseCase,
	GetLotByIdUseCase,
	GetCenterByIdUseCase,
	GetProviderByIdUseCase,
	GetSubProviderByIdUseCase,
} from "../../../application/use-cases/get-by-id.use-cases";
import { CreateModelDto } from "../dto/requests/create-model.dto";
import { CreateProgramDto } from "../dto/requests/create-program.dto";
import { CreateLotDto } from "../dto/requests/create-lot.dto";
import { CreateCenterDto } from "../dto/requests/create-center.dto";
import { CreateProviderDto } from "../dto/requests/create-provider.dto";
import { CreateSubProviderDto } from "../dto/requests/create-sub-provider.dto";
import {
	ModelResponse,
	ProgramResponse,
	LotResponse,
	CenterResponse,
	ProviderResponse,
	SubProviderResponse,
} from "../dto/responses/catalog.response";
import { CatalogPresenter } from "../presenters/catalog.presenter";
import type { ModelType } from "../../../domain/types";

@ApiTags("catalog")
@ApiBearerAuth("bearer")
@ApiSecurity("devAuth")
@Controller("catalog")
export class CatalogController {
	constructor(
		private readonly createModel: CreateModelUseCase,
		private readonly createProgram: CreateProgramUseCase,
		private readonly createLot: CreateLotUseCase,
		private readonly createCenter: CreateCenterUseCase,
		private readonly createProvider: CreateProviderUseCase,
		private readonly createSubProvider: CreateSubProviderUseCase,
		private readonly listModels: ListModelsUseCase,
		private readonly listPrograms: ListProgramsUseCase,
		private readonly listLots: ListLotsUseCase,
		private readonly listCenters: ListCentersUseCase,
		private readonly listProviders: ListProvidersUseCase,
		private readonly listSubProviders: ListSubProvidersUseCase,
		private readonly getModelById: GetModelByIdUseCase,
		private readonly getProgramById: GetProgramByIdUseCase,
		private readonly getLotById: GetLotByIdUseCase,
		private readonly getCenterById: GetCenterByIdUseCase,
		private readonly getProviderById: GetProviderByIdUseCase,
		private readonly getSubProviderById: GetSubProviderByIdUseCase,
		private readonly presenter: CatalogPresenter,
	) {}

	// ====================
	// Models
	// ====================

	@Post("models")
	@HttpCode(201)
	@ApiOperation({ summary: "Create a new model" })
	@ApiResponse({
		status: 201,
		description: "Model created",
		type: ModelResponse,
	})
	@ApiResponse({ status: 400, description: "Invalid input" })
	@ApiResponse({ status: 409, description: "Model already exists" })
	async createModelEndpoint(
		@Body() dto: CreateModelDto,
	): Promise<ModelResponse> {
		const output = await this.createModel.execute(dto);
		return this.presenter.toModelResponse(output);
	}

	@Get("models")
	@ApiOperation({ summary: "List all models" })
	@ApiQuery({
		name: "type",
		required: false,
		enum: ["detection", "external_classification", "internal_classification"],
	})
	@ApiResponse({
		status: 200,
		description: "Models retrieved",
		type: [ModelResponse],
	})
	async listModelsEndpoint(
		@Query("type") type?: ModelType,
	): Promise<ModelResponse[]> {
		const outputs = await this.listModels.execute(type ? { type } : undefined);
		return this.presenter.toModelListResponse(outputs);
	}

	@Get("models/:id")
	@ApiOperation({ summary: "Get model by ID" })
	@ApiResponse({
		status: 200,
		description: "Model retrieved",
		type: ModelResponse,
	})
	@ApiResponse({ status: 404, description: "Model not found" })
	async getModelEndpoint(
		@Param("id", new ParseUUIDPipe()) id: string,
	): Promise<ModelResponse> {
		const output = await this.getModelById.execute(id);
		return this.presenter.toModelResponse(output);
	}

	// ====================
	// Programs
	// ====================

	@Post("programs")
	@HttpCode(201)
	@ApiOperation({ summary: "Create a new program" })
	@ApiResponse({
		status: 201,
		description: "Program created",
		type: ProgramResponse,
	})
	@ApiResponse({ status: 400, description: "Invalid input" })
	@ApiResponse({ status: 409, description: "Program already exists" })
	async createProgramEndpoint(
		@Body() dto: CreateProgramDto,
	): Promise<ProgramResponse> {
		const output = await this.createProgram.execute(dto);
		return this.presenter.toProgramResponse(output);
	}

	@Get("programs")
	@ApiOperation({ summary: "List all programs" })
	@ApiResponse({
		status: 200,
		description: "Programs retrieved",
		type: [ProgramResponse],
	})
	async listProgramsEndpoint(): Promise<ProgramResponse[]> {
		const outputs = await this.listPrograms.execute();
		return this.presenter.toProgramListResponse(outputs);
	}

	@Get("programs/:id")
	@ApiOperation({ summary: "Get program by ID" })
	@ApiResponse({
		status: 200,
		description: "Program retrieved",
		type: ProgramResponse,
	})
	@ApiResponse({ status: 404, description: "Program not found" })
	async getProgramEndpoint(
		@Param("id", new ParseUUIDPipe()) id: string,
	): Promise<ProgramResponse> {
		const output = await this.getProgramById.execute(id);
		return this.presenter.toProgramResponse(output);
	}

	// ====================
	// Lots
	// ====================

	@Post("lots")
	@HttpCode(201)
	@ApiOperation({ summary: "Create a new lot" })
	@ApiResponse({ status: 201, description: "Lot created", type: LotResponse })
	@ApiResponse({ status: 400, description: "Invalid input" })
	@ApiResponse({ status: 404, description: "Program not found" })
	@ApiResponse({ status: 409, description: "Lot already exists" })
	async createLotEndpoint(@Body() dto: CreateLotDto): Promise<LotResponse> {
		const output = await this.createLot.execute(dto);
		return this.presenter.toLotResponse(output);
	}

	@Get("lots")
	@ApiOperation({ summary: "List all lots" })
	@ApiQuery({
		name: "programId",
		required: false,
		type: String,
		format: "uuid",
	})
	@ApiResponse({
		status: 200,
		description: "Lots retrieved",
		type: [LotResponse],
	})
	async listLotsEndpoint(
		@Query("programId") programId?: string,
	): Promise<LotResponse[]> {
		const outputs = await this.listLots.execute(
			programId ? { programId } : undefined,
		);
		return this.presenter.toLotListResponse(outputs);
	}

	@Get("lots/:id")
	@ApiOperation({ summary: "Get lot by ID" })
	@ApiResponse({ status: 200, description: "Lot retrieved", type: LotResponse })
	@ApiResponse({ status: 404, description: "Lot not found" })
	async getLotEndpoint(
		@Param("id", new ParseUUIDPipe()) id: string,
	): Promise<LotResponse> {
		const output = await this.getLotById.execute(id);
		return this.presenter.toLotResponse(output);
	}

	// ====================
	// Centers
	// ====================

	@Post("centers")
	@HttpCode(201)
	@ApiOperation({ summary: "Create a new center" })
	@ApiResponse({
		status: 201,
		description: "Center created",
		type: CenterResponse,
	})
	@ApiResponse({ status: 400, description: "Invalid input" })
	@ApiResponse({ status: 404, description: "Lot not found" })
	@ApiResponse({ status: 409, description: "Center already exists" })
	async createCenterEndpoint(
		@Body() dto: CreateCenterDto,
	): Promise<CenterResponse> {
		const output = await this.createCenter.execute(dto);
		return this.presenter.toCenterResponse(output);
	}

	@Get("centers")
	@ApiOperation({ summary: "List all centers" })
	@ApiQuery({ name: "lotId", required: false, type: String, format: "uuid" })
	@ApiResponse({
		status: 200,
		description: "Centers retrieved",
		type: [CenterResponse],
	})
	async listCentersEndpoint(
		@Query("lotId") lotId?: string,
	): Promise<CenterResponse[]> {
		const outputs = await this.listCenters.execute(
			lotId ? { lotId } : undefined,
		);
		return this.presenter.toCenterListResponse(outputs);
	}

	@Get("centers/:id")
	@ApiOperation({ summary: "Get center by ID" })
	@ApiResponse({
		status: 200,
		description: "Center retrieved",
		type: CenterResponse,
	})
	@ApiResponse({ status: 404, description: "Center not found" })
	async getCenterEndpoint(
		@Param("id", new ParseUUIDPipe()) id: string,
	): Promise<CenterResponse> {
		const output = await this.getCenterById.execute(id);
		return this.presenter.toCenterResponse(output);
	}

	// ====================
	// Providers
	// ====================

	@Post("providers")
	@HttpCode(201)
	@ApiOperation({ summary: "Create a new provider" })
	@ApiResponse({
		status: 201,
		description: "Provider created",
		type: ProviderResponse,
	})
	@ApiResponse({ status: 400, description: "Invalid input" })
	@ApiResponse({ status: 409, description: "Provider already exists" })
	async createProviderEndpoint(
		@Body() dto: CreateProviderDto,
	): Promise<ProviderResponse> {
		const output = await this.createProvider.execute(dto);
		return this.presenter.toProviderResponse(output);
	}

	@Get("providers")
	@ApiOperation({ summary: "List all providers" })
	@ApiResponse({
		status: 200,
		description: "Providers retrieved",
		type: [ProviderResponse],
	})
	async listProvidersEndpoint(): Promise<ProviderResponse[]> {
		const outputs = await this.listProviders.execute();
		return this.presenter.toProviderListResponse(outputs);
	}

	@Get("providers/:id")
	@ApiOperation({ summary: "Get provider by ID" })
	@ApiResponse({
		status: 200,
		description: "Provider retrieved",
		type: ProviderResponse,
	})
	@ApiResponse({ status: 404, description: "Provider not found" })
	async getProviderEndpoint(
		@Param("id", new ParseUUIDPipe()) id: string,
	): Promise<ProviderResponse> {
		const output = await this.getProviderById.execute(id);
		return this.presenter.toProviderResponse(output);
	}

	// ====================
	// SubProviders
	// ====================

	@Post("sub-providers")
	@HttpCode(201)
	@ApiOperation({ summary: "Create a new sub-provider" })
	@ApiResponse({
		status: 201,
		description: "SubProvider created",
		type: SubProviderResponse,
	})
	@ApiResponse({ status: 400, description: "Invalid input" })
	@ApiResponse({ status: 404, description: "Provider not found" })
	@ApiResponse({ status: 409, description: "SubProvider already exists" })
	async createSubProviderEndpoint(
		@Body() dto: CreateSubProviderDto,
	): Promise<SubProviderResponse> {
		const output = await this.createSubProvider.execute(dto);
		return this.presenter.toSubProviderResponse(output);
	}

	@Get("sub-providers")
	@ApiOperation({ summary: "List all sub-providers" })
	@ApiQuery({
		name: "providerId",
		required: false,
		type: String,
		format: "uuid",
	})
	@ApiResponse({
		status: 200,
		description: "SubProviders retrieved",
		type: [SubProviderResponse],
	})
	async listSubProvidersEndpoint(
		@Query("providerId") providerId?: string,
	): Promise<SubProviderResponse[]> {
		const outputs = await this.listSubProviders.execute(
			providerId ? { providerId } : undefined,
		);
		return this.presenter.toSubProviderListResponse(outputs);
	}

	@Get("sub-providers/:id")
	@ApiOperation({ summary: "Get sub-provider by ID" })
	@ApiResponse({
		status: 200,
		description: "SubProvider retrieved",
		type: SubProviderResponse,
	})
	@ApiResponse({ status: 404, description: "SubProvider not found" })
	async getSubProviderEndpoint(
		@Param("id", new ParseUUIDPipe()) id: string,
	): Promise<SubProviderResponse> {
		const output = await this.getSubProviderById.execute(id);
		return this.presenter.toSubProviderResponse(output);
	}
}
