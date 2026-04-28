import { Injectable } from "@nestjs/common";
import { UploadItem } from "../../domain/entities/upload-item.entity";
import { UploadSession } from "../../domain/entities/upload-session.entity";
import {
	CompleteSessionOutput,
	CompletionSummaryOutput,
	ItemProcessingResultOutput,
	ProcessingErrorOutput,
} from "../dto/complete-session/complete-session.output";
import { UploadItemStatus } from "../../domain/types";

export const COMPLETE_SESSION_MAPPER = Symbol("COMPLETE_SESSION_MAPPER");

export interface ICompleteSessionMapper {
	toOutput(
		session: UploadSession,
		results: readonly ItemProcessingResultOutput[],
	): CompleteSessionOutput;
	toItemResult(
		item: UploadItem,
		error?: ProcessingErrorOutput,
	): ItemProcessingResultOutput;
}

/**
 * Mapper responsible for transforming domain results to output DTOs
 * for the CompleteSession use case.
 */
@Injectable()
export class CompleteSessionMapper implements ICompleteSessionMapper {
	public toOutput(
		session: UploadSession,
		results: readonly ItemProcessingResultOutput[],
	): CompleteSessionOutput {
		return {
			sessionId: session.id,
			finalStatus: session.status,
			summary: this.calculateSummary(results),
			results: results,
		};
	}

	public toItemResult(
		item: UploadItem,
		error?: ProcessingErrorOutput,
	): ItemProcessingResultOutput {
		return {
			clientItemId: item.clientItemId.value,
			finalStatus: item.status,
			md5: item.properties.md5Hash ?? undefined,
			sizeBytes: item.properties.sizeInBytes,
			error,
		};
	}

	private calculateSummary(
		results: readonly ItemProcessingResultOutput[],
	): CompletionSummaryOutput {
		const getStatusKey = (
			status: UploadItemStatus,
		): keyof Omit<CompletionSummaryOutput, "total"> => {
			if (status === "VERIFIED") return "verified";
			if (status === "FAILED") return "failed";
			return "incomplete";
		};

		const summary = results.reduce(
			(acc, result) => {
				const key = getStatusKey(result.finalStatus);
				acc[key]++;
				return acc;
			},
			{ verified: 0, incomplete: 0, failed: 0, total: results.length },
		);

		return summary;
	}
}
