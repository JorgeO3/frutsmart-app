import { Injectable, Logger } from "@nestjs/common";
import { ConfigFacade } from "../../config/config.facade";
import { DefaultAzureCredential } from "@azure/identity";
import {
  BlobSASPermissions,
  BlobServiceClient,
  type ContainerClient,
  SASProtocol,
  generateBlobSASQueryParameters,
  type BlobSASSignatureValues,
  type BlobClient,
  type BlobProperties,
} from "@azure/storage-blob";

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
  y: number;
  m: number;
  d: number;
  filename: string;
}

export interface ContainerSasInput {
  container: string;
  blob?: string;
  permissions: string;
  expiresInMinutes?: number;
  contentType?: string;
}

const TTL_LIMITS = { MIN: 1, MAX: 240, DEFAULT: 15 } as const;
const SAS_PERMISSIONS = { UPLOAD: "cwa", DOWNLOAD: "r" } as const;
const TIME = { SKEW_MS: 60_000, MS_PER_MINUTE: 60_000 } as const;

export interface AzureBlobClientBundle {
  serviceClient: BlobServiceClient;
}

export interface AzureBlobClientInput {
  accountUrl?: string;
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
    userAgent = "frutsmart-api/azure-blob",
    retry = {},
  } = input;

  if (!accountUrl) {
    throw new Error("AZURE_STORAGE_ACCOUNT_URL is required");
  }

  const credential = new DefaultAzureCredential();
  const serviceClient = new BlobServiceClient(accountUrl, credential, {
    retryOptions: {
      maxTries: retry.maxTries ?? 4,
      tryTimeoutInMs: retry.tryTimeoutInMs ?? 30_000,
    },
    userAgentOptions: {
      userAgentPrefix: userAgent,
    },
  });

  return { serviceClient };
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
  ) {
    const az = this.config.azure;
    this.containerByDomain = {
      plant: az.containerPlant || "plant",
      field: az.containerField || "field",
    };
    this.baseUrl = az.publicBaseUrl || this.client.url;
    this.defaultTtlMin = az.sasTtlMinutes;
  }

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

  async generateSas(opts: SasOptions): Promise<SasResult> {
    const container = this.containerByDomain[opts.domain];
    await this.ensureContainer(container, "private");

    const ttl = this.normalizeTtl(opts.ttlMinutes);
    const now = Date.now();
    const startsOn = new Date(now - TIME.SKEW_MS);
    const expiresOn = new Date(now + ttl * TIME.MS_PER_MINUTE);
    const permissions = this.getPurposePermissions(opts.purpose);

    const key = await this.client.getUserDelegationKey(startsOn, expiresOn);

    const sas = generateBlobSASQueryParameters(
      {
        protocol: this.sasProtocol,
        version: this.sasVersion,
        containerName: container,
        blobName: opts.blobName,
        startsOn,
        expiresOn,
        permissions,
        contentType: opts.contentType,
      },
      key,
      this.client.accountName,
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
    const now = Date.now();
    const ttl = this.normalizeTtl(items[0]?.ttlMinutes);
    const startsOn = new Date(now - TIME.SKEW_MS);
    const expiresOn = new Date(now + ttl * TIME.MS_PER_MINUTE);

    const key = await this.client.getUserDelegationKey(startsOn, expiresOn);

    return Promise.all(
      items.map(async ({ domain, blobName, purpose, contentType }) => {
        const container = this.containerByDomain[domain];
        await this.ensureContainer(container, "private");

        const permissions = this.getPurposePermissions(purpose);

        const sas = generateBlobSASQueryParameters(
          {
            protocol: this.sasProtocol,
            version: this.sasVersion,
            containerName: container,
            blobName,
            startsOn,
            expiresOn,
            permissions,
            contentType,
          },
          key,
          this.client.accountName,
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

  async generateSasUrl(input: ContainerSasInput): Promise<string> {
    const { container, blob, expiresInMinutes = 15, contentType } = input;
    const permissions = BlobSASPermissions.parse(input.permissions);
    const now = new Date();
    const expiry = new Date(now.getTime() + expiresInMinutes * 60_000);
    const containerClient = this.getContainerClient(container);
    const resourceUrl = blob
      ? containerClient.getBlockBlobClient(blob).url
      : containerClient.url;

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

  private buildBlobUrl(container: string, blobName: string): string {
    if (!this.baseUrl) throw new Error("Azure baseUrl not configured");
    return `${this.baseUrl}/${container}/${blobName}`;
  }

  private get isAzurite(): boolean {
    return (
      this.client.url.startsWith("http://localhost:10000/") ||
      this.client.url.includes("127.0.0.1:10000")
    );
  }

  private get sasProtocol(): SASProtocol {
    return this.isAzurite ? SASProtocol.HttpsAndHttp : SASProtocol.Https;
  }

  private get sasVersion(): string {
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
}
