import { Injectable } from "@nestjs/common";
import { CompleteSessionOutput } from "../../../application/dto/complete-session/complete-session.output";
import {
	CompleteSessionResponse,
	CompleteSessionItemResult,
	CompleteSessionSummaryResponse,
	ProcessingResultError,
} from "../dto/responses/complete-session.response";
import { ICompleteSessionPresenter } from "./complete-session.presenter.port";

/**
 * Presenter for CompleteSession use case.
 * Maps from application Output DTO to HTTP Response DTO.
 */
@Injectable()
export class CompleteSessionPresenter implements ICompleteSessionPresenter {
	/**
	 * Transforms application layer output to HTTP response format.
	 * Handles serialization of domain types to primitives.
	 */
	toResponse(output: CompleteSessionOutput): CompleteSessionResponse {
		return {
			sessionId: output.sessionId,
			finalStatus: output.finalStatus,
			summary: this.mapSummary(output.summary),
			results: output.results.map((result) => this.mapItemResult(result)),
		};
	}

	private mapSummary(
		summary: CompleteSessionOutput["summary"],
	): CompleteSessionSummaryResponse {
		return {
			verified: summary.verified,
			incomplete: summary.incomplete,
			failed: summary.failed,
			total: summary.total,
		};
	}

	private mapItemResult(
		result: CompleteSessionOutput["results"][number],
	): CompleteSessionItemResult {
		return {
			clientItemId: result.clientItemId,
			finalStatus: result.finalStatus,
			sizeBytes: result.sizeBytes,
			md5: result.md5,
			error: result.error ? this.mapError(result.error) : undefined,
		};
	}

	private mapError(
		error: NonNullable<CompleteSessionOutput["results"][number]["error"]>,
	): ProcessingResultError {
		return {
			code: error.code,
			message: error.message,
			detailsJson: error.details,
		};
	}
}
