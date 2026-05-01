import { readFileSync, statSync, existsSync } from "node:fs";
import { basename } from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { resolve } from "node:path";

// ============================
// Config
// ============================
const BASE_URL = process.env.BACKEND_BASE_URL ?? "http://localhost:3000/api/v1";
const DEV_AUTH = process.env.BACKEND_DEV_AUTH ?? "dev-secret";
const INTERNAL_SECRET =
  process.env.BACKEND_INTERNAL_SECRET ??
  "c0d29aceed17f3ae05be3f73e24174755ae1ae585600d30b93414c9e4f7934e1";

// endpoint de refresh (ajústalo si tu API usa otro)
const SAS_REFRESH_PATH = (sessionId: string) =>
  `${BASE_URL}/upload/sessions/${sessionId}/sas/refresh`;

// Ajusta las rutas a tus archivos de prueba
const FILE_PATHS = [
  resolve(__dirname, "images/sample_image.webp"),
];

// ============================
// Tipos compartidos Upload
// ============================
enum UploadDomain {
  PLANT = "plant",
  FIELD = "field",
}
type UploadItemStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "UPLOADED"
  | "VERIFIED"
  | "FAILED"
  | "ABORTED";
type UploadSessionStatus = "OPEN" | "COMPLETED" | "FAILED";

type UploadFileDto = {
  clientItemId: string;
  fileName: string;
  fileSizeBytes: number;
  contentType: string;
  md5: string; // hex
};
type CreateUploadSessionDto = {
  domain: UploadDomain;
  clientBatchId: string;
  files: UploadFileDto[];
  description?: string;
};
type UploadItemResponse = {
  itemId: string;
  clientItemId: string;
  status: UploadItemStatus;
  blobContainer: string;
  blobName: string;
  createdAt: string;
};
type CreateUploadSessionResult = {
  sessionId: string;
  domain: "plant" | "field";
  clientBatchId?: string;
  status: UploadSessionStatus;
  createdAt: string;
  description?: string;
  items: UploadItemResponse[];
};

type SasItemDto = { blobName: string; contentType?: string };
type GetSasBatchRequestDto = { items: SasItemDto[] };
type SasEntryResponse = {
  blobName: string;
  url: string; // SAS URL
  blobUrl: string;
  expiresOn: string; // ISO
  contentType?: string;
};
type GetSasBatchResponse = { sas: SasEntryResponse[] };

type ClientItemIdDto = { clientItemId: string };
type CompleteSessionDto = {
  verifyAndPromote?: boolean;
  failOnIncomplete?: boolean;
  onlyClientItems?: ClientItemIdDto[];
};
type CompleteSessionItemResult = {
  clientItemId: string;
  finalStatus: UploadItemStatus;
  sizeBytes?: number;
  md5?: string;
  error?: {
    code?: string;
    message?: string;
    detailsJson?: Record<string, unknown>;
  };
};
type CompleteSessionSummaryResponse = {
  verified: number;
  incomplete: number;
  failed: number;
  total: number;
};
type CompleteSessionResponse = {
  sessionId: string;
  finalStatus: UploadSessionStatus;
  summary: CompleteSessionSummaryResponse;
  results: CompleteSessionItemResult[];
};

// ============================
// Tipos Catálogo (DTOs & Responses)
// ============================
type UUID = string;
type ModelType =
  | "detection"
  | "external_classification"
  | "internal_classification";
const MODEL_TYPES: readonly ModelType[] = [
  "detection",
  "external_classification",
  "internal_classification",
] as const;

type CreateModelDto = {
  id: UUID;
  name: string;
  versionTag: string;
  type: ModelType;
};
type CreateProgramDto = { id: UUID; name: string };
type CreateLotDto = { id: UUID; name: string; programId: UUID };
type CreateCenterDto = { id: UUID; name: string; lotId: UUID };
type CreateProviderDto = { id: UUID; name: string };
type CreateSubProviderDto = { id: UUID; name: string; providerId: UUID };

type ModelResponse = {
  id: UUID;
  name: string;
  versionTag: string;
  type: ModelType;
};
type ProgramResponse = { id: UUID; name: string };
type LotResponse = { id: UUID; name: string; programId: UUID };
type CenterResponse = { id: UUID; name: string; lotId: UUID };
type ProviderResponse = { id: UUID; name: string };
type SubProviderResponse = { id: UUID; name: string; providerId: UUID };

// ============================
// Tipos Evaluation
// ============================
type CreateResultDto = {
  id: UUID;
  aiClassName: string;
  aiConfidence: number;
  aiRawConfidencesJson: Record<string, number>;
  hfIsCorrect?: boolean;
  hfCorrectedClassName?: string;
  hfObservation?: string;
};
type CreatePhotoDto = {
  id: UUID;
  role: "raw" | "segmented" | "cropped";
  uploadItemId: UUID;
};
type CreateSegmentDto = {
  id: UUID;
  uploadItemId: UUID;
  bestClassName: string;
  bestConfidence: number;
  confidencesJson: Record<string, number>;
};
type CreateStepDto = {
  id: UUID;
  kind: "external" | "internal";
  iterationIndex: number; // 0..3
  result?: CreateResultDto;
  photos?: CreatePhotoDto[];
  segments?: CreateSegmentDto[];
};
type CreateEvaluationDto = {
  id: UUID;
  type: "PLANT_ANALYSIS" | "FIELD_EVENT";
  creationTimestamp: string; // ISO
  uploadSessionId: UUID;
  qrCode?: string;

  truckPlate: string;
  consecutiveNumber: string;

  // FIELD_EVENT | PLANT_ANALYSIS condicionales (ver esquema)
  providerKind?: "own" | "third-party";
  providerId?: UUID;
  subProviderId?: UUID;
  programId?: UUID;
  lotId?: UUID;
  centerId?: UUID;

  // Solo para PLANT_ANALYSIS + own (evaluation_lots)
  lotIds?: UUID[];

  deviceTimeOfDay: "day" | "night";
  deviceWeather: string;
  deviceHasInternet: boolean;
  geoLatitude: number;
  geoLongitude: number;
  harvestCriteriaJson: Record<string, unknown>;
  harvestObservation?: string;

  modelDetectionId?: UUID;
  modelExternalId?: UUID;
  modelInternalId?: UUID;

  steps?: CreateStepDto[];
};

type StepSummaryDto = {
  kind: "external" | "internal";
  iterationIndex: number;
  hasResult: boolean;
  photoCount: number;
  segmentCount: number;
};

type CreateEvaluationResponse = {
  id: UUID;
  type: "PLANT_ANALYSIS" | "FIELD_EVENT";
  isFinalized: boolean;
  createdAt: string; // date ISO
  totalSteps: number;
  totalPhotos: number;
  totalSegments: number;
  stepsSummary: StepSummaryDto[];
};

// ============================
//
// Utils
//
// ============================
function md5Hex(filePath: string): string {
  const fileBuffer = readFileSync(filePath);
  return createHash("md5").update(fileBuffer).digest("hex");
}
function md5Base64(buffer: Buffer): string {
  return createHash("md5").update(buffer).digest("base64");
}
function guessContentType(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  return "application/octet-stream";
}
function headersJSON(withInternal = false): HeadersInit {
  return {
    "Content-Type": "application/json",
    "x-dev-auth": DEV_AUTH,
    ...(withInternal ? { "x-internal-secret": INTERNAL_SECRET } : {}),
  };
}
async function doJson<T>(
  url: string,
  init: RequestInit,
  label: string,
): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`[${label}] HTTP ${res.status} ${res.statusText}\n${text}`);
  }
  return (await res.json()) as T;
}

// ============================
// Upload helpers
// ============================
function createUploadSessionDto(filePaths: string[]): {
  dto: CreateUploadSessionDto;
  byClientId: Map<
    string,
    { path: string; contentType: string; md5Hex: string }
  >;
} {
  const byClientId = new Map<
    string,
    { path: string; contentType: string; md5Hex: string }
  >();

  const files: UploadFileDto[] = filePaths.map((filePath) => {
    const size = statSync(filePath).size;
    const fileName = basename(filePath);
    const contentType = guessContentType(fileName);
    const clientItemId = randomUUID();
    const md5h = md5Hex(filePath);

    byClientId.set(clientItemId, { path: filePath, contentType, md5Hex: md5h });

    return {
      clientItemId,
      fileName,
      fileSizeBytes: size,
      contentType,
      md5: md5h,
    };
  });

  return {
    dto: {
      domain: UploadDomain.FIELD,
      clientBatchId: randomUUID(),
      files,
    },
    byClientId,
  };
}
async function putBlobToSas(
  sasUrl: string,
  data: Buffer,
  contentType: string,
  md5b64?: string,
): Promise<void> {
  const headers: HeadersInit = {
    "x-ms-blob-type": "BlockBlob",
    "Content-Type": contentType,
  };
  if (md5b64) headers["Content-MD5"] = md5b64;

  const res = await fetch(sasUrl, {
    method: "PUT",
    headers,
    body: data as unknown as BodyInit,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`[PUT Blob] HTTP ${res.status} ${res.statusText}\n${text}`);
  }
}

// ============================
// Catalog helpers
// ============================
const CatalogAPI = {
  createModel: (dto: CreateModelDto) =>
    doJson<ModelResponse>(
      `${BASE_URL}/catalog/models`,
      { method: "POST", headers: headersJSON(), body: JSON.stringify(dto) },
      "CreateModel",
    ),
  getModel: (id: UUID) =>
    doJson<ModelResponse>(
      `${BASE_URL}/catalog/models/${id}`,
      { method: "GET", headers: headersJSON() },
      "GetModel",
    ),
  listModels: (params?: { type?: ModelType }) => {
    const qs = params?.type ? `?type=${encodeURIComponent(params.type)}` : "";
    return doJson<ModelResponse[]>(
      `${BASE_URL}/catalog/models${qs}`,
      { method: "GET", headers: headersJSON() },
      "ListModels",
    );
  },

  createProgram: (dto: CreateProgramDto) =>
    doJson<ProgramResponse>(
      `${BASE_URL}/catalog/programs`,
      { method: "POST", headers: headersJSON(), body: JSON.stringify(dto) },
      "CreateProgram",
    ),
  getProgram: (id: UUID) =>
    doJson<ProgramResponse>(
      `${BASE_URL}/catalog/programs/${id}`,
      { method: "GET", headers: headersJSON() },
      "GetProgram",
    ),
  listPrograms: () =>
    doJson<ProgramResponse[]>(
      `${BASE_URL}/catalog/programs`,
      { method: "GET", headers: headersJSON() },
      "ListPrograms",
    ),

  createLot: (dto: CreateLotDto) =>
    doJson<LotResponse>(
      `${BASE_URL}/catalog/lots`,
      { method: "POST", headers: headersJSON(), body: JSON.stringify(dto) },
      "CreateLot",
    ),
  getLot: (id: UUID) =>
    doJson<LotResponse>(
      `${BASE_URL}/catalog/lots/${id}`,
      { method: "GET", headers: headersJSON() },
      "GetLot",
    ),
  listLots: (params?: { programId?: UUID }) => {
    const qs = params?.programId
      ? `?programId=${encodeURIComponent(params.programId)}`
      : "";
    return doJson<LotResponse[]>(
      `${BASE_URL}/catalog/lots${qs}`,
      { method: "GET", headers: headersJSON() },
      "ListLots",
    );
  },

  createCenter: (dto: CreateCenterDto) =>
    doJson<CenterResponse>(
      `${BASE_URL}/catalog/centers`,
      { method: "POST", headers: headersJSON(), body: JSON.stringify(dto) },
      "CreateCenter",
    ),
  getCenter: (id: UUID) =>
    doJson<CenterResponse>(
      `${BASE_URL}/catalog/centers/${id}`,
      { method: "GET", headers: headersJSON() },
      "GetCenter",
    ),
  listCenters: (params?: { lotId?: UUID }) => {
    const qs = params?.lotId
      ? `?lotId=${encodeURIComponent(params.lotId)}`
      : "";
    return doJson<CenterResponse[]>(
      `${BASE_URL}/catalog/centers${qs}`,
      { method: "GET", headers: headersJSON() },
      "ListCenters",
    );
  },

  createProvider: (dto: CreateProviderDto) =>
    doJson<ProviderResponse>(
      `${BASE_URL}/catalog/providers`,
      { method: "POST", headers: headersJSON(), body: JSON.stringify(dto) },
      "CreateProvider",
    ),
  getProvider: (id: UUID) =>
    doJson<ProviderResponse>(
      `${BASE_URL}/catalog/providers/${id}`,
      { method: "GET", headers: headersJSON() },
      "GetProvider",
    ),
  listProviders: () =>
    doJson<ProviderResponse[]>(
      `${BASE_URL}/catalog/providers`,
      { method: "GET", headers: headersJSON() },
      "ListProviders",
    ),

  createSubProvider: (dto: CreateSubProviderDto) =>
    doJson<SubProviderResponse>(
      `${BASE_URL}/catalog/sub-providers`,
      { method: "POST", headers: headersJSON(), body: JSON.stringify(dto) },
      "CreateSubProvider",
    ),
  getSubProvider: (id: UUID) =>
    doJson<SubProviderResponse>(
      `${BASE_URL}/catalog/sub-providers/${id}`,
      { method: "GET", headers: headersJSON() },
      "GetSubProvider",
    ),
  listSubProviders: (params?: { providerId?: UUID }) => {
    const qs = params?.providerId
      ? `?providerId=${encodeURIComponent(params.providerId)}`
      : "";
    return doJson<SubProviderResponse[]>(
      `${BASE_URL}/catalog/sub-providers${qs}`,
      { method: "GET", headers: headersJSON() },
      "ListSubProviders",
    );
  },
};

// ============================
// Evaluation helper
// ============================
const EvaluationAPI = {
  createEvaluation: (dto: CreateEvaluationDto) =>
    doJson<CreateEvaluationResponse>(
      `${BASE_URL}/evaluations`,
      { method: "POST", headers: headersJSON(), body: JSON.stringify(dto) },
      "CreateEvaluation",
    ),
};

// ============================
// MAIN
// ============================
// biome-ignore format: true
async function main() {
  // ====== UPLOAD FLOW ======
  if (FILE_PATHS.some((p) => !existsSync(p))) {
    throw new Error("One or more specified files do not exist.");
  }

  const { dto: uploadSessionDto, byClientId } = createUploadSessionDto(FILE_PATHS);
  console.log("CreateUploadSessionDto:", JSON.stringify(uploadSessionDto, null, 2));

  const createRes = await doJson<CreateUploadSessionResult>(
    `${BASE_URL}/upload/sessions`,
    { method: "POST", headers: headersJSON(true), body: JSON.stringify(uploadSessionDto) },
    "CreateSession",
  );
  console.log("CreateUploadSessionResult:", JSON.stringify(createRes, null, 2));

  const sasReq: GetSasBatchRequestDto = {
    items: createRes.items.map((it) => ({
      blobName: it.blobName,
      contentType: byClientId.get(it.clientItemId)?.contentType ?? "application/octet-stream",
    })),
  };

  const initialSasRes = await doJson<GetSasBatchResponse>(
    `${BASE_URL}/upload/sessions/${createRes.sessionId}/sas-batch`,
    { method: "POST", headers: headersJSON(true), body: JSON.stringify(sasReq) },
    "GetSasBatch",
  );
  console.log("GetSasBatchResponse (initial):", JSON.stringify(initialSasRes, null, 2));

  // Refresh “porque sí”
  let effectiveSasList: SasEntryResponse[] = initialSasRes.sas;
  try {
    const refreshRes = await doJson<GetSasBatchResponse>(
      SAS_REFRESH_PATH(createRes.sessionId),
      {
        method: "POST",
        headers: headersJSON(true),
        body: JSON.stringify(sasReq),
      },
      "RefreshSasBatch",
    );
    console.log("RefreshSasBatchResponse:", JSON.stringify(refreshRes, null, 2));
    if (Array.isArray(refreshRes?.sas) && refreshRes.sas.length > 0) {
      effectiveSasList = refreshRes.sas;
    } else {
      console.warn("Refresh returned empty/invalid SAS list. Falling back to initial SAS.");
    }
  } catch (err) {
    console.warn("RefreshSasBatch call failed, using initial SAS. Error:", (err as Error).message);
  }

  // Upload blobs
  const sasByBlob = new Map(effectiveSasList.map((e) => [e.blobName, e]));
  for (const item of createRes.items) {
    const mapping = byClientId.get(item.clientItemId);
    if (!mapping) {
      console.warn(`No mapping for clientItemId=${item.clientItemId}. Skipping.`);
      continue;
    }
    const sas = sasByBlob.get(item.blobName);
    if (!sas) {
      console.warn(`No SAS entry for blobName=${item.blobName}. Skipping.`);
      continue;
    }
    const buf = readFileSync(mapping.path);
    const contentMd5 = md5Base64(buf);
    console.log(`Uploading ${mapping.path} -> ${sas.blobUrl}`);
    await putBlobToSas(sas.url, buf, mapping.contentType, contentMd5);
  }

  // Complete session
  const completeDto: CompleteSessionDto = { verifyAndPromote: true, failOnIncomplete: false };
  const completeRes = await doJson<CompleteSessionResponse>(
    `${BASE_URL}/upload/sessions/${createRes.sessionId}/complete`,
    { method: "POST", headers: headersJSON(true), body: JSON.stringify(completeDto) },
    "CompleteSession",
  );
  console.log("CompleteSessionResponse:", JSON.stringify(completeRes, null, 2));

  // ====== CATALOG FLOW ======
  console.log("\n=== Catalog E2E ===");

  // — Models
  const modelDto: CreateModelDto = {
    id: randomUUID(),
    name: `Detector-${Date.now()}`,
    versionTag: "v1.0.0",
    type: MODEL_TYPES[0], // "detection"
  };
  const model = await CatalogAPI.createModel(modelDto);
  console.log("Model created:", model);
  const modelById = await CatalogAPI.getModel(model.id);
  console.log("Model by id:", modelById);
  const modelsAll = await CatalogAPI.listModels();
  console.log("Models list:", modelsAll.length);
  const modelsByType = await CatalogAPI.listModels({ type: "detection" });
  console.log("Models list (filtered by type=detection):", modelsByType.length);

  // — Programs
  const programDto: CreateProgramDto = { id: randomUUID(), name: `Program-${Date.now()}` };
  const program = await CatalogAPI.createProgram(programDto);
  console.log("Program created:", program);
  const programById = await CatalogAPI.getProgram(program.id);
  console.log("Program by id:", programById);
  const programsAll = await CatalogAPI.listPrograms();
  console.log("Programs list:", programsAll.length);

  // — Lots
  const lotDto: CreateLotDto = { id: randomUUID(), name: `Lot-${Date.now()}`, programId: program.id };
  const lot = await CatalogAPI.createLot(lotDto);
  console.log("Lot created:", lot);
  const lotById = await CatalogAPI.getLot(lot.id);
  console.log("Lot by id:", lotById);
  const lotsAll = await CatalogAPI.listLots();
  console.log("Lots list:", lotsAll.length);
  const lotsByProgram = await CatalogAPI.listLots({ programId: program.id });
  console.log(`Lots list (programId=${program.id}):`, lotsByProgram.length);

  // — Centers
  const centerDto: CreateCenterDto = { id: randomUUID(), name: `Center-${Date.now()}`, lotId: lot.id };
  const center = await CatalogAPI.createCenter(centerDto);
  console.log("Center created:", center);
  const centerById = await CatalogAPI.getCenter(center.id);
  console.log("Center by id:", centerById);
  const centersAll = await CatalogAPI.listCenters();
  console.log("Centers list:", centersAll.length);
  const centersByLot = await CatalogAPI.listCenters({ lotId: lot.id });
  console.log(`Centers list (lotId=${lot.id}):`, centersByLot.length);

  // — Providers
  const providerDto: CreateProviderDto = { id: randomUUID(), name: `Provider-${Date.now()}` };
  const provider = await CatalogAPI.createProvider(providerDto);
  console.log("Provider created:", provider);
  const providerById = await CatalogAPI.getProvider(provider.id);
  console.log("Provider by id:", providerById);
  const providersAll = await CatalogAPI.listProviders();
  console.log("Providers list:", providersAll.length);

  // — SubProviders
  const subProviderDto: CreateSubProviderDto = { id: randomUUID(), name: `SubProvider-${Date.now()}`, providerId: provider.id };
  const subProvider = await CatalogAPI.createSubProvider(subProviderDto);
  console.log("SubProvider created:", subProvider);
  const subProviderById = await CatalogAPI.getSubProvider(subProvider.id);
  console.log("SubProvider by id:", subProviderById);
  const subProvidersAll = await CatalogAPI.listSubProviders();
  console.log("SubProviders list:", subProvidersAll.length);
  const subProvidersByProvider = await CatalogAPI.listSubProviders({ providerId: provider.id });
  console.log(`SubProviders list (providerId=${provider.id}):`, subProvidersByProvider.length);

  // ====== EVALUATION FLOW (FIELD_EVENT) ======
  console.log("\n=== Evaluation E2E (FIELD_EVENT) ===");

  // Reglas que vamos a cumplir según el esquema:
  // FIELD_EVENT:
  //   provider_kind = NULL
  //   program_id, lot_id, center_id = NOT NULL
  //   provider_id, sub_provider_id = NULL
  // Además: upload_session_id debe referenciar una sesión COMPLETED (ya lo hicimos),
  // y no deben existir ítems con estados PENDING/IN_PROGRESS/INCOMPLETE (nuestro flujo los deja VERIFIED).

  // Tomamos un uploadItemId válido para photos/segments
  const firstItemId = createRes.items[0]?.itemId;
  if (!firstItemId) throw new Error("No upload items available to attach photos/segments in evaluation");

  const evalDto: CreateEvaluationDto = {
    id: randomUUID(),
    type: "FIELD_EVENT",
    creationTimestamp: new Date().toISOString(),
    uploadSessionId: createRes.sessionId,
    // providerKind OMITIDO (NULL)
    programId: program.id,
    lotId: lot.id,
    centerId: center.id,

    truckPlate: "ABC-123",
    consecutiveNumber: `CN-${Date.now()}`,

    deviceTimeOfDay: "day",
    deviceWeather: "clear",
    deviceHasInternet: true,
    geoLatitude: -12.046374,
    geoLongitude: -77.042793,
    harvestCriteriaJson: { minSize: 10, maxSize: 20 },
    harvestObservation: "All good",

    // (opcional) modelos
    modelDetectionId: model.id,

    steps: [
      {
        id: randomUUID(),
        kind: "external",
        iterationIndex: 0,
        result: {
          id: randomUUID(),
          aiClassName: "class_A",
          aiConfidence: 0.93,
          aiRawConfidencesJson: { class_A: 0.93, class_B: 0.07 },
          hfIsCorrect: true,
        },
        photos: [
          {
            id: randomUUID(),
            role: "raw",
            uploadItemId: firstItemId,
          },
        ],
        segments: [
          {
            id: randomUUID(),
            uploadItemId: firstItemId,
            bestClassName: "class_A",
            bestConfidence: 0.91,
            confidencesJson: { class_A: 0.91, class_B: 0.09 },
          },
        ],
      },
    ],
  };

  const evaluation = await EvaluationAPI.createEvaluation(evalDto);
  console.log("CreateEvaluationResponse:", JSON.stringify(evaluation, null, 2));

  // Chequeos básicos del response
  if (evaluation.id !== evalDto.id) {
    throw new Error(`Evaluation id mismatch. expected=${evalDto.id}, got=${evaluation.id}`);
  }
  if (evaluation.type !== "FIELD_EVENT") {
    throw new Error(`Evaluation type mismatch. expected=FIELD_EVENT, got=${evaluation.type}`);
  }
  if (evaluation.isFinalized !== true) {
    throw new Error(`Evaluation should be finalized at creation time`);
  }
  if (evaluation.totalSteps < 1 || evaluation.totalPhotos < 1 || evaluation.totalSegments < 1) {
    throw new Error(`Evaluation summary counts look wrong: ${JSON.stringify(evaluation)}`);
  }

  console.log("\n✅ Evaluation E2E (FIELD_EVENT) finished OK");
  console.log("\n✅ All E2E finished OK");
}

// Ejecutar si es el módulo principal
if (require.main === module) {
  main().catch((err: Error) => {
    console.error("❌ Script failed:");
    console.error(err);
    if ((err as { cause?: unknown })?.cause) {
      console.error("Cause:", (err as { cause?: unknown }).cause);
    }
    process.exit(1);
  });
}
