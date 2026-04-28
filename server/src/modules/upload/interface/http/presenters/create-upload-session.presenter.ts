import { Injectable } from "@nestjs/common";
import { CreateUploadSessionOutput } from "../../../application/dto/create-upload-session/create-upload-session.output";
import {
	CreateUploadSessionResponse,
	UploadItemResponse,
} from "../dto/responses/create-upload-session.response";
import { ICreateUploadSessionPresenter } from "./create-upload-session.presenter.port";

/**
 * Presenter for CreateUploadSession use case.
 * Maps from application Output DTO to HTTP Response DTO.
 */
@Injectable()
export class CreateUploadSessionPresenter
	implements ICreateUploadSessionPresenter
{
	/**
	 * Transforms application layer output to HTTP response format.
	 * Handles serialization of domain types (Date, UUID) to primitives (string).
	 */
	toResponse(output: CreateUploadSessionOutput): CreateUploadSessionResponse {
		return {
			sessionId: output.sessionId,
			domain: output.domain,
			clientBatchId: output.clientBatchId,
			status: output.status,
			createdAt: output.createdAt.toISOString(),
			items: output.items.map((item) => this.mapItem(item)),
		};
	}

	private mapItem(
		item: CreateUploadSessionOutput["items"][number],
	): UploadItemResponse {
		return {
			itemId: item.itemId,
			clientItemId: item.clientItemId,
			status: item.status,
			blobContainer: item.blobContainer,
			blobName: item.blobName,
			createdAt: item.createdAt.toISOString(),
		};
	}
}
