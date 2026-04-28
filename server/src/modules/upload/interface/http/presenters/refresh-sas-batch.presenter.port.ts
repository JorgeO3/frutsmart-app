import { RefreshSasBatchOutput } from "../../../application/dto/refresh-sas-batch/refresh-sas-batch.output";
import { RefreshSasBatchResponse } from "../dto/responses/refresh-sas.response";

/**
 * Token for RefreshSasBatchPresenter injection
 */
export const REFRESH_SAS_BATCH_PRESENTER = Symbol(
	"REFRESH_SAS_BATCH_PRESENTER",
);

/**
 * Port interface for RefreshSasBatchPresenter
 * Maps application output to HTTP response.
 */
export interface IRefreshSasBatchPresenter {
	toResponse(output: RefreshSasBatchOutput): RefreshSasBatchResponse;
}
