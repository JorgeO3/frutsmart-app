export type ErrCode =
  | "E_STORAGE_FULL"
  | "E_FS_IO"
  | "E_FS_BUSY"
  | "E_DB_BUSY"
  | "E_DB_CONSTRAINT"
  | "E_DB_CORRUPT"
  | "E_NET_OFFLINE"
  | "E_NET_TIMEOUT"
  | "E_NET_5XX"
  | "E_PERMISSIONS"
  | "E_IMAGE_OOM"
  | "E_IMAGE_UNSUPPORTED"
  | "E_PDF_GEN"
  | "E_UPLOAD_RESUME"
  | "E_UNKNOWN";

export class AppError extends Error {
  constructor(
    public code: ErrCode,
    message: string,
    public step?: string,
    public cause?: unknown,
    public extra?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export const isTransient = (e: unknown) => {
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  const msg = String((e as any)?.message ?? e);
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  const code = (e as any)?.code as ErrCode | undefined;
  return Boolean(
    (code &&
      ["E_DB_BUSY", "E_FS_BUSY", "E_NET_TIMEOUT", "E_NET_5XX"].includes(
        code,
      )) ||
      /SQLITE_BUSY|LOCKED|I\/O|ECONNRESET|ETIMEDOUT|5\d\d/.test(msg),
  );
};
