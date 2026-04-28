import { CompleteSessionOutput } from "../../../application/dto/complete-session/complete-session.output";
import { CompleteSessionResponse } from "../dto/responses/complete-session.response";

/**
 * Token for CompleteSessionPresenter injection
 */
export const COMPLETE_SESSION_PRESENTER = Symbol("COMPLETE_SESSION_PRESENTER");

/**
 * Port interface for CompleteSessionPresenter
 * Maps application output to HTTP response.
 */
export interface ICompleteSessionPresenter {
	toResponse(output: CompleteSessionOutput): CompleteSessionResponse;
}
