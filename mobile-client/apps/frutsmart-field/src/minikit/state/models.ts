export type AnalysisManifest = {
  version: 1;
  analysisId: string;
  stagingDir: string;
  finalDir: string;
  db: { status: "pending" | "committed" };
  files: Array<{
    rel: string;
    kind: "raw" | "segmented" | "cropped";
    status: "staged" | "promoted";
    sha256?: string;
  }>;
};

export type UploadManifest = {
  version: 1;
  fileId: string;
  localPath: string;
  size: number;
  backend: "s3" | "tus" | "custom";
  sessionId: string;
  chunkSize: number;
  completedBytes: number;
  parts: Array<{
    index: number;
    offset: number;
    size: number;
    etag?: string | null;
  }>;
  status: "pending" | "uploading" | "completed";
};
