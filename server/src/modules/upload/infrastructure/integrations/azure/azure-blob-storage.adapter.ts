import { Inject, Injectable } from "@nestjs/common";
import {
	IBlobStorage,
	ObjectMetadata,
	SignedUrlRequest,
	SignedUrlResponse,
	ListObjectEntry,
} from "../../../application/ports/blob-storage.port";
import { type ILogger, LOGGER } from "../../../application/ports/logger.port";
import { AzureBlobService } from "@platform/integrations/azure/azure-blob.client";
import {
	SasOptions,
	SasResult,
} from "@platform/integrations/azure/azure-blob.client";
import { UploadDomain } from "src/modules/upload/domain/types";

@Injectable()
export class AzureBlobStorageAdapter implements IBlobStorage {
	constructor(
		@Inject(LOGGER) private readonly logger: ILogger,
		private readonly azureService: AzureBlobService,
	) {}

	// ---------------- SAS (lote) ----------------

	async generateUploadUrls(
		requests: SignedUrlRequest[],
		ttlMinutes: number,
	): Promise<SignedUrlResponse[]> {
		this.logger.debug("Generating upload SAS (batch)", {
			count: requests.length,
			ttlMinutes,
		});

		const opts: SasOptions[] = requests.map((r) => ({
			domain: r.domain,
			blobName: r.objectKey,
			contentType: r.contentType,
			ttlMinutes,
			purpose: "upload",
		}));

		// ↓ Firma local en lote (sin I/O a Azure)
		const results: SasResult[] = await this.azureService.generateSasBatch(opts);
		return this.mapResults(results);
	}

	async generateDownloadUrls(
		requests: Omit<SignedUrlRequest, "contentType">[],
		ttlMinutes: number,
	): Promise<SignedUrlResponse[]> {
		this.logger.debug("Generating download SAS (batch)", {
			count: requests.length,
			ttlMinutes,
		});

		const opts: SasOptions[] = requests.map((r) => ({
			domain: r.domain,
			blobName: r.objectKey,
			ttlMinutes,
			purpose: "download",
		}));

		const results: SasResult[] = await this.azureService.generateSasBatch(opts);
		return this.mapResults(results);
	}

	// ---------------- Metadatos puntuales ----------------

	async getObjectMetadata(
		objectKey: string,
		domain: UploadDomain,
	): Promise<ObjectMetadata> {
		this.logger.debug("Getting object metadata", { objectKey, domain });

		const azureMeta = await this.azureService.getBlobMetadata(
			domain,
			objectKey,
		);
		return {
			exists: azureMeta.exists,
			sizeInBytes: azureMeta.sizeBytes,
			md5Hash: azureMeta.contentMD5,
		};
	}

	// ---------------- Listado por prefijo (para /complete) ----------------

	async listObjectsByPrefix(
		domain: UploadDomain,
		prefix: string,
	): Promise<ListObjectEntry[]> {
		this.logger.debug("Listing objects by prefix", { domain, prefix });

		const items = await this.azureService.listBlobsFlatByPrefix(domain, prefix);
		return items.map((b) => ({
			objectKey: b.name,
			sizeInBytes: b.properties?.contentLength,
			contentType: b.properties?.contentType,
			etag: b.properties?.etag,
			lastModified: b.properties?.lastModified,
		}));
	}

	// ---------------- Helpers ----------------

	generateBlobName(
		domain: UploadDomain,
		clientItemId: string,
		fileName: string,
	): string {
		const ts = new Date().toISOString().replace(/[:.]/g, "-");
		return `${domain}/${ts}/${clientItemId}/${fileName}`;
	}

	private mapResults(results: SasResult[]): SignedUrlResponse[] {
		return results.map((res) => ({
			objectKey: res.blobName,
			url: res.url,
			objectUrl: res.blobUrl,
			expiresOn: new Date(res.expiresOn),
		}));
	}
}
