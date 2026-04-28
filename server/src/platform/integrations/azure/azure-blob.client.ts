import { Injectable, Logger } from "@nestjs/common";
import { ConfigFacade } from "../../config/config.facade";
import { DefaultAzureCredential } from "@azure/identity";
import {
	BlobSASPermissions,
	BlobServiceClient,
	type ContainerClient,
	SASProtocol,
	StorageSharedKeyCredential,
	generateBlobSASQueryParameters,
	type BlobSASSignatureValues,
	type BlobClient,
	type BlobProperties,
} from "@azure/storage-blob";

// =============================================================================
// Public Types (merged from previous shared service)
// =============================================================================
export type Purpose = "upload" | "download";
export type Domain = "plant" | "field";
export type PhotoRoot = "plant" | "field";
export type PhotoFlow = "external" | "internal";
export type PhotoType = "raw" | "cropped" | "segmented";

export interface SasOptions {
	domain: Domain;
	blobName: string;
	purpose: Purpose;
	contentType?: string;
	ttlMinutes?: number;
}

export interface SasResult {
	blobName: string;
	url: string;
	blobUrl: string;
	expiresOn: string;
	contentType?: string;
}

export interface BlobMetadata {
	exists: boolean;
	sizeBytes?: number;
	contentType?: string;
	etag?: string;
	lastModified?: Date;
	contentMD5?: string;
}

export interface UploadPathParams {
	root: PhotoRoot;
	flow: PhotoFlow;
	photoType: PhotoType;
	y: number; // year
	m: number; // month
	d: number; // day
	filename: string;
}

// Backwards compatible low-level SAS input (container-centric)
export interface ContainerSasInput {
	container: string;
	blob?: string;
	permissions: string; // e.g. rwdlac
	expiresInMinutes?: number;
	contentType?: string;
}

// =============================================================================
// Internal constants
// =============================================================================
const TTL_LIMITS = { MIN: 1, MAX: 240, DEFAULT: 15 } as const;
const SAS_PERMISSIONS = { UPLOAD: "cwa", DOWNLOAD: "r" } as const; // minimal set for upload/download
const TIME = { SKEW_MS: 60_000, MS_PER_MINUTE: 60_000 } as const;

// =============================================================================
// Azure Blob Client Factory
// =============================================================================
export interface AzureBlobClientBundle {
	serviceClient: BlobServiceClient;
	sharedKey?: StorageSharedKeyCredential;
}

export interface AzureBlobClientInput {
	accountUrl?: string;
	connectionString?: string;
	accountName?: string;
	accountKey?: string;
	userAgent?: string;
	retry?: {
		maxTries?: number;
		tryTimeoutInMs?: number;
	};
}

export function createBlobServiceClient(
	input: AzureBlobClientInput,
): AzureBlobClientBundle {
	const {
		accountUrl = process.env.AZURE_STORAGE_ACCOUNT_URL,
		connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING,
		accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME,
		accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY,
		userAgent = "frutsmart-api/azure-blob",
		retry = {},
	} = input;

	const pipelineOptions = {
		retryOptions: {
			maxTries: retry.maxTries ?? 4,
			tryTimeoutInMs: retry.tryTimeoutInMs ?? 30_000,
		},
		userAgentOptions: {
			userAgentPrefix: userAgent,
		},
	};

	// Priority 1: Connection string (for local dev with Azurite)
	if (connectionString) {
		const serviceClient = BlobServiceClient.fromConnectionString(
			connectionString,
			pipelineOptions,
		);
		const sharedKey =
			accountName && accountKey
				? new StorageSharedKeyCredential(accountName, accountKey)
				: undefined;
		return { serviceClient, sharedKey };
	}

	// Priority 2: Managed Identity (for Azure production)
	if (!accountUrl) {
		throw new Error(
			"AZURE_STORAGE_ACCOUNT_URL is required when using Managed Identity",
		);
	}

	const credential = new DefaultAzureCredential();
	const serviceClient = new BlobServiceClient(
		accountUrl,
		credential,
		pipelineOptions,
	);
	const sharedKey =
		accountName && accountKey
			? new StorageSharedKeyCredential(accountName, accountKey)
			: undefined;

	return { serviceClient, sharedKey };
}

@Injectable()
export class AzureBlobService {
	private readonly logger = new Logger(AzureBlobService.name);
	private readonly containerByDomain: Record<Domain, string>;
	private readonly baseUrl?: string;
	private readonly defaultTtlMin?: number;

	constructor(
		private readonly client: BlobServiceClient,
		private readonly config: ConfigFacade,
		private readonly sharedKey?: StorageSharedKeyCredential,
	) {
		const az = this.config.azure;
		this.containerByDomain = {
			plant: az.containerPlant || "plant",
			field: az.containerField || "field",
		};
		this.baseUrl = az.publicBaseUrl || this.client.url;
		this.defaultTtlMin = az.sasTtlMinutes;
	}

	// -------------------------------------------------------------------------
	// Basic container operations
	// -------------------------------------------------------------------------
	async ping(containerName?: string): Promise<void> {
		const fallback = this.config.azure.defaultContainer;
		const target = containerName || fallback;
		if (!target) return;
		await this.getContainerClient(target).getProperties();
	}

	getContainerClient(containerName: string): ContainerClient {
		return this.client.getContainerClient(containerName);
	}

	async ensureContainer(
		containerName: string,
		access: "private" | "blob" | "container" = "private",
	): Promise<ContainerClient> {
		const container = this.getContainerClient(containerName);
		await container.createIfNotExists({
			access: access === "private" ? undefined : access,
		});
		return container;
	}

	// -------------------------------------------------------------------------
	// Domain / higher-level APIs
	// -------------------------------------------------------------------------
	async generateSas(opts: SasOptions): Promise<SasResult> {
		this.requireSharedKey();
		const container = this.containerByDomain[opts.domain];

		// 👇 Asegura contenedor antes de firmar
		await this.ensureContainer(container, "private");

		const ttl = this.normalizeTtl(opts.ttlMinutes);
		const now = Date.now();
		const startsOn = new Date(now - TIME.SKEW_MS);
		const expiresOn = new Date(now + ttl * TIME.MS_PER_MINUTE);
		const permissions = this.getPurposePermissions(opts.purpose);

		if (!this.sharedKey) {
			throw new Error("Shared key is not available");
		}

		const sas = generateBlobSASQueryParameters(
			{
				protocol: this.isAzurite ? SASProtocol.HttpsAndHttp : SASProtocol.Https,
				version: this.sasVersion, // si lo tienes, p.ej. "2021-08-06"
				containerName: container,
				blobName: opts.blobName,
				startsOn,
				expiresOn,
				permissions,
				contentType: opts.contentType,
			},
			this.sharedKey,
		).toString();

		const blobUrl = this.buildBlobUrl(container, opts.blobName);
		return {
			url: `${blobUrl}?${sas}`,
			blobUrl,
			expiresOn: expiresOn.toISOString(),
			contentType: opts.contentType,
			blobName: opts.blobName,
		};
	}

	async generateSasBatch(items: SasOptions[]): Promise<SasResult[]> {
		this.requireSharedKey();

		const now = Date.now();
		const ttl = this.normalizeTtl(items[0]?.ttlMinutes);
		const startsOn = new Date(now - TIME.SKEW_MS);
		const expiresOn = new Date(now + ttl * TIME.MS_PER_MINUTE);

		return Promise.all(
			items.map(async ({ domain, blobName, purpose, contentType }) => {
				const container = this.containerByDomain[domain];

				if (!this.sharedKey) {
					throw new Error("Shared key is not available");
				}

				// 👇 Asegura contenedor para cada dominio implicado
				await this.ensureContainer(container, "private");

				const permissions = this.getPurposePermissions(purpose);

				const sas = generateBlobSASQueryParameters(
					{
						protocol: this.isAzurite
							? SASProtocol.HttpsAndHttp
							: SASProtocol.Https,
						version: this.sasVersion, // si lo tienes definido
						containerName: container,
						blobName,
						startsOn,
						expiresOn,
						permissions,
						contentType,
					},
					this.sharedKey,
				).toString();

				const blobUrl = this.buildBlobUrl(container, blobName);
				return {
					blobName,
					url: `${blobUrl}?${sas}`,
					blobUrl,
					expiresOn: expiresOn.toISOString(),
					contentType,
				};
			}),
		);
	}

	/** Lista flat por prefijo (1..pocas llamadas paginadas) */
	async listBlobsFlatByPrefix(
		domain: Domain,
		prefix: string,
	): Promise<
		Array<{
			name: string;
			properties?: {
				contentLength?: number;
				contentType?: string;
				etag?: string;
				lastModified?: Date;
			};
		}>
	> {
		const containerName = this.containerByDomain[domain];
		const container = this.getContainerClient(containerName);
		const out: Array<{ name: string; properties?: BlobProperties }> = [];
		for await (const b of container.listBlobsFlat({ prefix })) {
			out.push({ name: b.name, properties: b.properties });
		}
		return out;
	}

	getUploadPath(params: UploadPathParams): string {
		const month = String(params.m).padStart(2, "0");
		const day = String(params.d).padStart(2, "0");
		return [
			params.root,
			params.flow,
			params.photoType,
			params.y,
			month,
			day,
			params.filename,
		].join("/");
	}

	async getBlobMetadata(
		domain: Domain,
		blobName: string,
	): Promise<BlobMetadata> {
		this.requireSharedKey(); // ensures baseUrl & client ready
		try {
			const container = this.containerByDomain[domain];
			const containerClient = await this.ensureContainer(container, "private");
			const blobClient: BlobClient = containerClient.getBlobClient(blobName);
			const properties = await blobClient.getProperties();
			return {
				exists: true,
				sizeBytes: properties.contentLength || undefined,
				contentType: properties.contentType || undefined,
				etag: properties.etag || undefined,
				lastModified: properties.lastModified || undefined,
				contentMD5: properties.contentMD5
					? Buffer.from(properties.contentMD5).toString("hex")
					: undefined,
			};
		} catch (error: unknown) {
			if ((error as { statusCode?: number }).statusCode === 404) {
				return { exists: false };
			}
			this.logger.error("Error getting blob metadata", {
				domain,
				blobName,
				error: (error as { message?: string }).message,
			});
			throw error;
		}
	}

	async blobExists(domain: Domain, blobName: string): Promise<boolean> {
		const meta = await this.getBlobMetadata(domain, blobName);
		return meta.exists;
	}

	// -------------------------------------------------------------------------
	// Low-level container-scoped SAS (backwards compat with previous provider)
	// -------------------------------------------------------------------------
	async generateSasUrl(input: ContainerSasInput): Promise<string> {
		const { container, blob, expiresInMinutes = 15, contentType } = input;
		const permissions = BlobSASPermissions.parse(input.permissions);
		const now = new Date();
		const expiry = new Date(now.getTime() + expiresInMinutes * 60_000);
		const containerClient = this.getContainerClient(container);
		const resourceUrl = blob
			? containerClient.getBlockBlobClient(blob).url
			: containerClient.url;

		if (this.sharedKey) {
			const values: BlobSASSignatureValues = {
				containerName: container,
				blobName: blob,
				expiresOn: expiry,
				permissions,
				protocol: this.sasProtocol,
				version: this.sasVersion,
				contentType,
			};
			const sas = generateBlobSASQueryParameters(
				values,
				this.sharedKey,
			).toString();
			return `${resourceUrl}?${sas}`;
		}

		const key = await this.client.getUserDelegationKey(now, expiry);
		const values: BlobSASSignatureValues = {
			containerName: container,
			blobName: blob,
			expiresOn: expiry,
			permissions,
			protocol: SASProtocol.Https,
			contentType,
		};
		const sas = generateBlobSASQueryParameters(
			values,
			key,
			this.client.accountName,
		).toString();
		return `${resourceUrl}?${sas}`;
	}

	// -------------------------------------------------------------------------
	// Internal helpers
	// -------------------------------------------------------------------------
	private buildBlobUrl(container: string, blobName: string): string {
		if (!this.baseUrl) throw new Error("Azure baseUrl not configured");
		return `${this.baseUrl}/${container}/${blobName}`;
	}

	private get isAzurite(): boolean {
		// funciona tanto si vienes por connection string como por URL directa
		return (
			this.client.url.startsWith("http://localhost:10000/") ||
			this.client.url.includes("127.0.0.1:10000") ||
			this.config.azure.accountName === "devstoreaccount1"
		);
	}

	private get sasProtocol(): SASProtocol {
		return this.isAzurite ? SASProtocol.HttpsAndHttp : SASProtocol.Https;
	}

	private get sasVersion(): string {
		// Azurite soporta bien 2021-08-06. Hazlo configurable si quieres:
		return process.env.AZURE_SAS_VERSION ?? "2021-08-06";
	}

	private getPurposePermissions(purpose: Purpose): BlobSASPermissions {
		const perm =
			purpose === "upload" ? SAS_PERMISSIONS.UPLOAD : SAS_PERMISSIONS.DOWNLOAD;
		return BlobSASPermissions.parse(perm);
	}

	private normalizeTtl(input?: number): number {
		const ttl = input ?? this.defaultTtlMin ?? TTL_LIMITS.DEFAULT;
		if (!Number.isFinite(ttl)) return TTL_LIMITS.DEFAULT;
		if (ttl < TTL_LIMITS.MIN) return TTL_LIMITS.MIN;
		if (ttl > TTL_LIMITS.MAX) return TTL_LIMITS.MAX;
		return Math.round(ttl);
	}

	private requireSharedKey(): void {
		if (!this.sharedKey) {
			// For now we require Shared Key to ensure domain container operations consistency.
			// Could be extended to support user delegation SAS if needed.
			throw new Error(
				"Azure Storage shared key credentials not configured. Set AZURE_STORAGE_ACCOUNT_NAME and AZURE_STORAGE_ACCOUNT_KEY",
			);
		}
	}
}
