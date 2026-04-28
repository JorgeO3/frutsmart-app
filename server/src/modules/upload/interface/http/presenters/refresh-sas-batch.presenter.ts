import { Injectable } from "@nestjs/common";
import { RefreshSasBatchOutput } from "../../../application/dto/refresh-sas-batch/refresh-sas-batch.output";
import {
	RefreshSasBatchResponse,
	RefreshSasEntryResponse,
} from "../dto/responses/refresh-sas.response";
import { IRefreshSasBatchPresenter } from "./refresh-sas-batch.presenter.port";

/**
 * Presenter for RefreshSasBatch use case.
 * Maps from application Output DTO to HTTP Response DTO.
 */
@Injectable()
export class RefreshSasBatchPresenter implements IRefreshSasBatchPresenter {
	/**
	 * Transforms application layer output to HTTP response format.
	 * Handles serialization of domain types (Date) to primitives (string).
	 */
	toResponse(output: RefreshSasBatchOutput): RefreshSasBatchResponse {
		return {
			sas: output.urls.map((url) => this.mapSasEntry(url)),
		};
	}

	private mapSasEntry(
		url: RefreshSasBatchOutput["urls"][number],
	): RefreshSasEntryResponse {
		return {
			blobName: url.objectKey,
			url: url.signedUrl,
			blobUrl: url.objectUrl,
			expiresOn: url.expiresOn.toISOString(),
			contentType: url.contentType,
		};
	}
}
