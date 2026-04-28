import { UploadDomain } from "../../domain/types";

/** Request para generar URL firmada (por-objeto) */
export interface SignedUrlRequest {
	readonly objectKey: string; // p.ej. plant/2025-10-11/session-.../item-.../file.jpg
	readonly domain: UploadDomain;
	readonly contentType?: string;
}

/** Respuesta con SAS + canónica */
export interface SignedUrlResponse {
	readonly objectKey: string;
	readonly url: string; // SAS temporal
	readonly objectUrl: string; // URL canónica (sin SAS)
	readonly expiresOn: Date;
}

/** Metadatos mínimos de un objeto */
export interface ObjectMetadata {
	readonly exists: boolean;
	readonly sizeInBytes?: number;
	readonly md5Hash?: string;
}

/** Resultado de listar por prefijo (para /complete) */
export interface ListObjectEntry {
	readonly objectKey: string;
	readonly sizeInBytes?: number;
	readonly contentType?: string;
	readonly etag?: string;
	readonly lastModified?: Date;
}

export const BLOB_STORAGE = "BlobStorage";

export interface IBlobStorage {
	/** Firma URLs de subida en lote (sin I/O a Azure; firma local). */
	generateUploadUrls(
		requests: SignedUrlRequest[],
		ttlMinutes: number,
	): Promise<SignedUrlResponse[]>;

	/** Firma URLs de descarga en lote (opcional). */
	generateDownloadUrls(
		requests: Omit<SignedUrlRequest, "contentType">[],
		ttlMinutes: number,
	): Promise<SignedUrlResponse[]>;

	/** Obtiene metadatos puntuales (úsalo parsimoniosamente). */
	getObjectMetadata(
		objectKey: string,
		domain: UploadDomain,
	): Promise<ObjectMetadata>;

	/**
	 * Lista objetos por prefijo (estrategia recomendada para /complete).
	 * Devuelve todos los blobs bajo el prefijo en 1..pocas llamadas paginadas.
	 */
	listObjectsByPrefix(
		domain: UploadDomain,
		prefix: string,
	): Promise<ListObjectEntry[]>;

	/** Genera un nombre canónico para almacenar (helper de dominio). */
	generateBlobName(
		domain: UploadDomain,
		clientItemId: string,
		fileName: string,
	): string;
}
