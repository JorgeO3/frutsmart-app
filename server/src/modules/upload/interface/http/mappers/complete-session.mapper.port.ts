import { CompleteSessionDto } from "../dto/requests/complete-session.dto";
import { CompleteSessionInput } from "../../../application/dto/complete-session/complete-session.input";

/**
 * Token for CompleteSessionHttpMapper injection
 */
export const COMPLETE_SESSION_HTTP_MAPPER = Symbol(
	"COMPLETE_SESSION_HTTP_MAPPER",
);

/**
 * Port interface for CompleteSessionHttpMapper
 * Maps HTTP DTOs to application DTOs.
 */
export interface ICompleteSessionHttpMapper {
	toInput(sessionId: string, dto: CompleteSessionDto): CompleteSessionInput;
}
