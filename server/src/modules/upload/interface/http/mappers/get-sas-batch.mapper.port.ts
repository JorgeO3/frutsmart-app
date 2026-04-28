import { GetSasBatchRequestDto } from "../dto/requests/get-sas-batch.dto";
import { GetSasBatchInput } from "../../../application/dto/get-sas-batch/get-sas-batch.input";

/**
 * Token for GetSasBatchHttpMapper injection
 */
export const GET_SAS_BATCH_HTTP_MAPPER = Symbol("GET_SAS_BATCH_HTTP_MAPPER");

/**
 * Port interface for GetSasBatchHttpMapper
 * Maps HTTP DTOs to application DTOs.
 */
export interface IGetSasBatchHttpMapper {
	toInput(sessionId: string, dto: GetSasBatchRequestDto): GetSasBatchInput;
}
