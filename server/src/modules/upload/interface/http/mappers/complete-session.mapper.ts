import { Injectable } from "@nestjs/common";
import { CompleteSessionDto } from "../dto/requests/complete-session.dto";
import { CompleteSessionInput } from "../../../application/dto/complete-session/complete-session.input";
import { ICompleteSessionHttpMapper } from "./complete-session.mapper.port";

/**
 * Mapper for CompleteSession endpoint.
 * Transforms HTTP Request DTO to Application Use Case Input.
 */
@Injectable()
export class CompleteSessionHttpMapper implements ICompleteSessionHttpMapper {
	/**
	 * Maps HTTP DTO and session ID to application layer input.
	 *
	 * @param sessionId - Session identifier from URL parameter
	 * @param dto - Validated HTTP request DTO
	 * @returns Application use case input
	 */
	toInput(sessionId: string, dto: CompleteSessionDto): CompleteSessionInput {
		return {
			sessionId,
			verifyAndPromote: dto.verifyAndPromote ?? true,
			failOnIncomplete: dto.failOnIncomplete ?? false,
			onlyClientItemIds: dto.onlyClientItems?.map((item) => item.clientItemId),
		};
	}
}
