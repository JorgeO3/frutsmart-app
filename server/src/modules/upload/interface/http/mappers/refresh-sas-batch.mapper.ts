import { Injectable } from "@nestjs/common";
import { RefreshSasBatchDto } from "../dto/requests/refresh-sas-batch.dto";
import { RefreshSasBatchInput } from "../../../application/dto/refresh-sas-batch/refresh-sas-batch.input";
import { IRefreshSasBatchHttpMapper } from "./refresh-sas-batch.mapper.port";

/**
 * Mapper for RefreshSasBatch endpoint.
 * Transforms HTTP Request DTO to Application Use Case Input.
 */
@Injectable()
export class RefreshSasBatchHttpMapper implements IRefreshSasBatchHttpMapper {
	/**
	 * Maps HTTP DTO and session ID to application layer input.
	 *
	 * @param sessionId - Session identifier from URL parameter
	 * @param dto - Validated HTTP request DTO
	 * @returns Application use case input
	 */
	toInput(sessionId: string, dto: RefreshSasBatchDto): RefreshSasBatchInput {
		return {
			sessionId,
			items: dto.items.map((item) => ({
				objectKey: item.blobName,
				contentType: item.contentType,
			})),
		};
	}
}
