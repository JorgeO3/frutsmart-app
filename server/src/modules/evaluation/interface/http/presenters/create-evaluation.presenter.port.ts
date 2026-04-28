import { CreateEvaluationDto } from "../dto/requests/create-evaluation.dto";
import { CreateEvaluationInput } from "../../../application/dto/create-evaluation/create-evaluation.input";
import { CreateEvaluationOutput } from "../../../application/dto/create-evaluation/create-evaluation.output";
import { CreateEvaluationResponse } from "../dto/responses/create-evaluation.response";

/**
 * Token for CreateEvaluationPresenter injection
 */
export const CREATE_EVALUATION_PRESENTER = Symbol(
	"CREATE_EVALUATION_PRESENTER",
);

/**
 * Port interface for CreateEvaluationPresenter
 * Maps between HTTP DTOs and application DTOs.
 */
export interface ICreateEvaluationPresenter {
	/**
	 * Map HTTP request DTO to application input DTO.
	 */
	toInput(dto: CreateEvaluationDto): CreateEvaluationInput;

	/**
	 * Map application output DTO to HTTP response DTO.
	 */
	toHttp(output: CreateEvaluationOutput): CreateEvaluationResponse;
}
