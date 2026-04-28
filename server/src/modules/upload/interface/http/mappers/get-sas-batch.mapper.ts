import { Injectable } from "@nestjs/common";
import { GetSasBatchRequestDto } from "../dto/requests/get-sas-batch.dto";
import { GetSasBatchInput } from "../../../application/dto/get-sas-batch/get-sas-batch.input";
import { IGetSasBatchHttpMapper } from "./get-sas-batch.mapper.port";

/**
 * Mapper for GetSasBatch endpoint.
 * Transforms HTTP Request DTO to Application Use Case Input.
 */
@Injectable()
export class GetSasBatchHttpMapper implements IGetSasBatchHttpMapper {
	/**
	 * Maps HTTP DTO and session ID to application layer input.
	 *
	 * @param sessionId - Session identifier from URL parameter
	 * @param dto - Validated HTTP request DTO
	 * @returns Application use case input
	 */
	toInput(sessionId: string, dto: GetSasBatchRequestDto): GetSasBatchInput {
		return {
			sessionId,
			ttlMinutes: undefined, // Use default from use case
			items: dto.items.map((item) => ({
				objectKey: item.blobName,
				contentType: item.contentType,
			})),
		};
	}
}
