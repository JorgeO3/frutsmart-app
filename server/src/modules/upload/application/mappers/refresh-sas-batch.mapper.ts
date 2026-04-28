import { Injectable } from "@nestjs/common";
import { SignedUrlResponse } from "../ports/blob-storage.port";
import {
	RefreshSasBatchOutput,
	RefreshedSignedUrlOutput,
} from "../dto/refresh-sas-batch/refresh-sas-batch.output";

export const REFRESH_SAS_BATCH_MAPPER = Symbol("REFRESH_SAS_BATCH_MAPPER");

export interface IRefreshSasBatchMapper {
	toOutput(signedUrls: SignedUrlResponse[]): RefreshSasBatchOutput;
}

/**
 * Mapper responsable de convertir los resultados del servicio de almacenamiento
 * al DTO de salida para el caso de uso RefreshSasBatch.
 */
@Injectable()
export class RefreshSasBatchMapper implements IRefreshSasBatchMapper {
	/**
	 * Convierte un array de respuestas de URL firmada del puerto de almacenamiento
	 * al DTO de salida del caso de uso.
	 * @param signedUrls El array de respuestas del puerto IBlobStorage.
	 * @returns El DTO de salida RefreshSasBatchOutput.
	 */
	public toOutput(signedUrls: SignedUrlResponse[]): RefreshSasBatchOutput {
		const urls: RefreshedSignedUrlOutput[] = signedUrls.map((response) => ({
			objectKey: response.objectKey,
			signedUrl: response.url,
			objectUrl: response.objectUrl,
			expiresOn: response.expiresOn,
		}));

		return { urls };
	}
}
