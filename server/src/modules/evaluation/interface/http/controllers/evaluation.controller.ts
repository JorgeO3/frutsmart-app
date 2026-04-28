import {
	Body,
	Controller,
	HttpCode,
	HttpStatus,
	Inject,
	Post,
} from "@nestjs/common";
import {
	ApiBearerAuth,
	ApiForbiddenResponse,
	ApiOperation,
	ApiResponse,
	ApiSecurity,
	ApiTags,
	ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { CreateEvaluationUseCase } from "../../../application/use-cases/create-evaluation.use-case";
import { CreateEvaluationDto } from "../dto/requests/create-evaluation.dto";
import { CreateEvaluationResponse } from "../dto/responses/create-evaluation.response";
import type { ICreateEvaluationPresenter } from "../presenters/create-evaluation.presenter.port";
import { CREATE_EVALUATION_PRESENTER } from "../presenters/create-evaluation.presenter.port";

/**
 * Controller for evaluation endpoints.
 */
@ApiTags("evaluations")
@ApiBearerAuth("bearer")
@ApiSecurity("devAuth")
@Controller("evaluations")
export class EvaluationController {
	constructor(
		private readonly createEvaluationUseCase: CreateEvaluationUseCase,
		@Inject(CREATE_EVALUATION_PRESENTER)
		private readonly presenter: ICreateEvaluationPresenter,
	) {}

	/**
	 * Create a complete evaluation (one-shot).
	 */
	@Post()
	@HttpCode(HttpStatus.CREATED)
	@ApiOperation({
		summary: "Create a complete evaluation",
		description:
			"Creates a complete evaluation with steps, results, photos, and segments in a single operation. The evaluation is immediately finalized.",
	})
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: "Evaluation created successfully",
		type: CreateEvaluationResponse,
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: "Invalid input (validation error or business rule violation)",
	})
	@ApiUnauthorizedResponse({ description: "Missing or invalid credentials" })
	@ApiForbiddenResponse({ description: "Insufficient permissions" })
	@ApiResponse({
		status: HttpStatus.INTERNAL_SERVER_ERROR,
		description: "Internal server error",
	})
	async createEvaluation(
		@Body() dto: CreateEvaluationDto,
	): Promise<CreateEvaluationResponse> {
		const input = this.presenter.toInput(dto);
		const output = await this.createEvaluationUseCase.execute(input);
		return this.presenter.toHttp(output);
	}
}
