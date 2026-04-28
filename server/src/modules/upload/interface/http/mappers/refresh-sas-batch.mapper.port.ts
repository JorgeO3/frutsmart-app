import { RefreshSasBatchDto } from "../dto/requests/refresh-sas-batch.dto";
import { RefreshSasBatchInput } from "../../../application/dto/refresh-sas-batch/refresh-sas-batch.input";

/**
 * Token for RefreshSasBatchHttpMapper injection
 */
export const REFRESH_SAS_BATCH_HTTP_MAPPER = Symbol(
	"REFRESH_SAS_BATCH_HTTP_MAPPER",
);

/**
 * Port interface for RefreshSasBatchHttpMapper
 * Maps HTTP DTOs to application DTOs.
 */
export interface IRefreshSasBatchHttpMapper {
	toInput(sessionId: string, dto: RefreshSasBatchDto): RefreshSasBatchInput;
}
