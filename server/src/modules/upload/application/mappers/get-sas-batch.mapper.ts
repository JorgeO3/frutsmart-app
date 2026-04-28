import { Injectable } from "@nestjs/common";
import { SignedUrlResponse } from "../ports/blob-storage.port";
import {
	GetSasBatchOutput,
	SignedUrl,
} from "../dto/get-sas-batch/get-sas-batch.output";

export const GET_SAS_BATCH_MAPPER = Symbol("GET_SAS_BATCH_MAPPER");

export interface IGetSasBatchMapper {
	toOutput(signedUrls: SignedUrlResponse[]): GetSasBatchOutput;
}

/**
 * Mapper responsable de convertir los resultados del servicio de almacenamiento
 * al DTO de salida para el caso de uso GetSasBatch.
 */
@Injectable()
export class GetSasBatchMapper implements IGetSasBatchMapper {
	/**
	 * Convierte un array de respuestas de URL firmada del puerto de almacenamiento
	 * al DTO de salida del caso de uso.
	 * @param signedUrls El array de respuestas del puerto IBlobStorage.
	 * @returns El DTO de salida GetSasBatchOutput.
	 */
	public toOutput(signedUrls: SignedUrlResponse[]): GetSasBatchOutput {
		const urls: SignedUrl[] = signedUrls.map((response) => ({
			objectKey: response.objectKey,
			signedUrl: response.url,
			objectUrl: response.objectUrl,
			expiresOn: response.expiresOn,
		}));

		return { urls };
	}
}
