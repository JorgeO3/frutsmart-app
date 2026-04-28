import { GetSasBatchOutput } from "../../../application/dto/get-sas-batch/get-sas-batch.output";
import { GetSasBatchResponse } from "../dto/responses/get-sas-batch.response";

/**
 * Token for GetSasBatchPresenter injection
 */
export const GET_SAS_BATCH_PRESENTER = Symbol("GET_SAS_BATCH_PRESENTER");

/**
 * Port interface for GetSasBatchPresenter
 * Maps application output to HTTP response.
 */
export interface IGetSasBatchPresenter {
	toResponse(output: GetSasBatchOutput): GetSasBatchResponse;
}
