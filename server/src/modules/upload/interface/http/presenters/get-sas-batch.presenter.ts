import { Injectable } from "@nestjs/common";
import { GetSasBatchOutput } from "../../../application/dto/get-sas-batch/get-sas-batch.output";
import {
	GetSasBatchResponse,
	SasEntryResponse,
} from "../dto/responses/get-sas-batch.response";
import { IGetSasBatchPresenter } from "./get-sas-batch.presenter.port";

/**
 * Presenter for GetSasBatch use case.
 * Maps from application Output DTO to HTTP Response DTO.
 */
@Injectable()
export class GetSasBatchPresenter implements IGetSasBatchPresenter {
	/**
	 * Transforms application layer output to HTTP response format.
	 * Handles serialization of domain types (Date) to primitives (string).
	 */
	toResponse(output: GetSasBatchOutput): GetSasBatchResponse {
		return {
			sas: output.urls.map((url) => this.mapSasEntry(url)),
		};
	}

	private mapSasEntry(
		url: GetSasBatchOutput["urls"][number],
	): SasEntryResponse {
		return {
			blobName: url.objectKey,
			url: url.signedUrl,
			blobUrl: url.objectUrl,
			expiresOn: url.expiresOn.toISOString(),
			contentType: url.contentType,
		};
	}
}
