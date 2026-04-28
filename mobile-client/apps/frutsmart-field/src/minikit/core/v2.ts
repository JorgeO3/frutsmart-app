// minikit.v2.types-dx.ts — Expo 53 / RN 0.79 — Type-safety & DX refinements
// -----------------------------------------------------------------------------
// Objetivo: subir el type-safety (cero any), mejorar DX (API ergonómica),
// mantener compatibilidad con el minikit previo. Incluye:
// - AppError con ErrCode exhaustivo
// - EventBus tipado (Emittery-like features sobre mitt adapter opcional)
// - TaskBuilder con acumulación de contexto tipado (discriminated unions)
// - Step runtime con retry/deadline coherentes
// - Concurrencia con runningJobs:Set
// - Guards de payload por tarea (sin Zod)
// - Sentry wiring con tipos
// - ImageOps con timeout y release ordenado
// - GC de jobs y guardas de background
// -----------------------------------------------------------------------------

// =======================
// 1) TIPOS BÁSICOS & ERRORES
// =======================

export type ErrCode =
  | "E_UNKNOWN"
  | "E_VALIDATION"
  | "E_NET_OFFLINE"
  | "E_FS_IO"
  | "E_IMAGE_OOM"
  | "E_IMAGE_UNSUPPORTED"
  | "E_DB_BUSY"
  | "E_CONCURRENCY";

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

export function asMessage(e: unknown): string {
  if (typeof e === "object" && e && "message" in e) {
    const m = (e as { message?: unknown }).message;
    return typeof m === "string" ? m : String(m);
  }
  return String(e);
}

export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new AppError("E_UNKNOWN", message);
}

export const isTransient = (e: unknown): boolean => {
  const m = asMessage(e);
  return /(timeout|temporary|E_FS_IO|SQLITE_BUSY|network.*reset|ECONNRESET|ETIMEDOUT)/i.test(
    m,
  );
};

// =======================
// 2) EVENT BUS TIPADO
// =======================

export type EventMap = Record<string, unknown>;

export interface EventBus<E extends EventMap> {
  on<K extends keyof E>(
    event: K,
    handler: (payload: E[K]) => void,
    opts?: { signal?: AbortSignal },
  ): () => void;
  once<K extends keyof E>(
    event: K,
    predicate?: (payload: E[K]) => boolean,
  ): Promise<E[K]>;
  off<K extends keyof E>(event: K, handler: (payload: E[K]) => void): void;
  emit<K extends keyof E>(event: K, payload: E[K]): Promise<void>;
  onAny?(
    handler: <K extends keyof E>(event: K, payload: E[K]) => void,
  ): () => void;
  clear?(event?: keyof E): void;
}

// Implementación por defecto con mitt (ligero, cross-runtime). Puedes cambiar a Emittery
// si prefieres DX extra (once() nativa, async iterators). Ésta expone la misma interfaz.
import mitt, { type Emitter } from "mitt";

export class MittBus<E extends EventMap> implements EventBus<E> {
  private ee: Emitter<E> = mitt<E>();
  on<K extends keyof E>(
    event: K,
    handler: (payload: E[K]) => void,
    opts?: { signal?: AbortSignal },
  ) {
    this.ee.on(event, handler as (v: E[keyof E]) => void);
    if (opts?.signal) {
      const off = () => this.off(event, handler);
      opts.signal.addEventListener("abort", off, { once: true });
      return () => {
        this.off(event, handler);
        opts.signal?.removeEventListener("abort", off);
      };
    }
    return () => this.off(event, handler);
  }
  once<K extends keyof E>(
    event: K,
    predicate?: (payload: E[K]) => boolean,
  ): Promise<E[K]> {
    return new Promise<E[K]>((resolve) => {
      const un = this.on(event, (p) => {
        if (!predicate || predicate(p)) {
          un();
          resolve(p);
        }
      });
    });
  }
  off<K extends keyof E>(event: K, handler: (payload: E[K]) => void) {
    this.ee.off(event, handler as (v: E[keyof E]) => void);
  }
  async emit<K extends keyof E>(event: K, payload: E[K]) {
    this.ee.emit(event, payload as E[keyof E]);
  }
  onAny?(handler: <K extends keyof E>(event: K, payload: E[K]) => void) {
    const wrapped = ((type: keyof E, ev: E[keyof E]) => handler(type, ev)) as (
      type: keyof E,
      payload: E[keyof E],
    ) => void;
    this.ee.on("*", wrapped);
    return () => this.ee.off("*", wrapped);
  }
  clear?(event?: keyof E) {
    if (event) this.ee.all.delete(event as keyof E);
    else this.ee.all.clear();
  }
}

export type JobEvents = {
  "job:start": { jobId: string; type: string };
  "job:done": { jobId: string; type: string };
  "job:failed": { jobId: string; type: string; step?: string; error: unknown };
  "step:start": { jobId: string; type: string; step: string; attempt: number };
  "step:success": { jobId: string; type: string; step: string };
  "step:error": { jobId: string; type: string; step: string; error: unknown };
};

export const jobEvents: EventBus<JobEvents> = new MittBus<JobEvents>();

// =======================
// 3) RETRY & UTILIDADES
// =======================

export type RetryOptions = {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs?: number;
  jitterRatio?: number; // 0..1
  maxElapsedMs?: number; // deadline por step
  signal?: AbortSignal;
  isTransient?: (e: unknown) => boolean;
};

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted)
    return Promise.reject(new DOMException("aborted", "AbortError"));
  return new Promise((res, rej) => {
    const id = setTimeout(res, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(id);
        rej(new DOMException("aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

export async function retry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions,
): Promise<T> {
  const {
    maxAttempts,
    baseDelayMs,
    maxDelayMs = 10_000,
    jitterRatio = 0.3,
    maxElapsedMs,
    signal,
    isTransient: _isTransient = isTransient,
  } = opts;
  const start = Date.now();
  let attempt = 0;
  let lastErr: unknown;
  while (attempt < maxAttempts) {
    if (signal?.aborted) throw new DOMException("aborted", "AbortError");
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      attempt++;
      if (attempt >= maxAttempts) break;
      if (!_isTransient(e)) break;
      const elapsed = Date.now() - start;
      if (maxElapsedMs && elapsed >= maxElapsedMs) break;
      const backoff = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
      const jitter = backoff * jitterRatio * Math.random();
      const wait = Math.max(0, backoff - jitter);
      const remaining = maxElapsedMs
        ? Math.max(0, maxElapsedMs - elapsed)
        : Number.POSITIVE_INFINITY;
      await sleep(Math.min(wait, remaining), signal);
    }
  }
  throw lastErr;
}

export const RETRY_FS = {
  maxAttempts: 3,
  baseDelayMs: 250,
  maxDelayMs: 1500,
  maxElapsedMs: 8000,
} as const;
export const RETRY_DB = {
  maxAttempts: 5,
  baseDelayMs: 200,
  maxDelayMs: 1500,
  maxElapsedMs: 8000,
} as const;
export const RETRY_NET = {
  maxAttempts: 8,
  baseDelayMs: 400,
  maxDelayMs: 5000,
  maxElapsedMs: 240000,
} as const;

// =======================
// 4) TASKS: API TIPADA & BUILDER
// =======================

// Definición de Step con types seguros
export type StepRunner<
  TPayload,
  TCtxIn extends Record<string, unknown>,
  TDelta extends Record<string, unknown>,
> = (
  ctx: Readonly<TCtxIn>,
  payload: Readonly<TPayload>,
  env: { signal?: AbortSignal },
) => Promise<TDelta | undefined>;

export type StepDef<
  TPayload,
  TCtxIn extends Record<string, unknown>,
  TDelta extends Record<string, unknown>,
> = {
  name: string;
  requiresNetwork?: boolean;
  retry?: Partial<RetryOptions> & {
    maxAttempts?: number;
    baseDelayMs?: number;
  };
  run: StepRunner<TPayload, TCtxIn, TDelta>;
};

export type TaskDef<
  TType extends string,
  TPayload,
  TCtx extends Record<string, unknown>,
> = {
  type: TType;
  steps: Array<
    StepDef<TPayload, Record<string, unknown>, Record<string, unknown>>
  >; // ejecución progresiva (el builder mantiene los tipos)
  jobDeadlineMs?: number;
};

// Builder con acumulación de contexto tipado
export class TaskBuilder<
  TType extends string,
  TPayload,
  TCtx extends Record<string, unknown> = Record<string, never>,
> {
  private _steps: Array<
    StepDef<TPayload, Record<string, unknown>, Record<string, unknown>>
  > = [];
  constructor(private _type: TType) {}
  addStep<K extends string, V extends Record<string, unknown>>(
    name: K,
    runner: StepRunner<TPayload, TCtx, V>,
    opts?: Omit<StepDef<TPayload, TCtx, V>, "name" | "run">,
  ): TaskBuilder<TType, TPayload, TCtx & V> {
    const step: StepDef<TPayload, TCtx, V> = {
      name,
      run: runner,
      requiresNetwork: opts?.requiresNetwork,
      retry: opts?.retry,
    };
    this._steps.push(
      step as StepDef<
        TPayload,
        Record<string, unknown>,
        Record<string, unknown>
      >,
    );
    return this as unknown as TaskBuilder<TType, TPayload, TCtx & V>;
  }
  build(def?: { jobDeadlineMs?: number }): TaskDef<TType, TPayload, TCtx> {
    return {
      type: this._type,
      steps: this._steps,
      jobDeadlineMs: def?.jobDeadlineMs,
    } as TaskDef<TType, TPayload, TCtx>;
  }
}

// =======================
// 5) REGISTRY & QUEUE (MMKV/AsyncStorage adapt)
// =======================

// Nota: provee tus adaptadores reales de KV e índice (MMKV, AsyncStorage, etc.)
export type JobRow = {
  id: string;
  type: string;
  payload: string; // JSON
  nextStep: number;
  status: "pending" | "running" | "done" | "failed";
  createdAt: number;
  updatedAt: number;
};

const kv = {
  getString: (k: string): string | undefined => undefined,
  set: (k: string, v: string) => void 0,
  delete: (k: string) => void 0,
};

function getIndex(): string[] {
  return [];
}
function setIndex(ids: string[]): void {
  void ids;
}

const registry = new Map<
  string,
  TaskDef<string, unknown, Record<string, unknown>>
>();
export function registerTask<
  TType extends string,
  TPayload,
  TCtx extends Record<string, unknown>,
>(def: TaskDef<TType, TPayload, TCtx>): void {
  if (registry.has(def.type))
    throw new AppError("E_UNKNOWN", `Task already registered: ${def.type}`);
  registry.set(
    def.type,
    def as unknown as TaskDef<string, unknown, Record<string, unknown>>,
  );
}

export function enqueueJob<TType extends string>(input: {
  id?: string;
  type: TType;
  payload: unknown;
}): string {
  const id =
    input.id ??
    `${input.type}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
  const row: JobRow = {
    id,
    type: input.type,
    payload: JSON.stringify(input.payload),
    nextStep: 0,
    status: "pending",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  kv.set(`job:${id}`, JSON.stringify(row));
  const ids = getIndex();
  setIndex([id, ...ids]);
  return id;
}

// =======================
// 6) RUNTIME DE EJECUCIÓN
// =======================

const runningJobs = new Set<string>();
export const MAX_PARALLEL_JOBS = 1;

export async function runOnce(effects?: {
  isOnline?: () => Promise<boolean>;
}): Promise<void> {
  if (runningJobs.size >= MAX_PARALLEL_JOBS) return;
  const ids = getIndex();
  const row = ids
    .map((id) => kv.getString(`job:${id}`))
    .map((s) => (s ? (JSON.parse(s) as JobRow) : undefined))
    .find(
      (r) =>
        r &&
        (r.status === "pending" || r.status === "running") &&
        !runningJobs.has(r.id),
    );
  if (!row) return;

  const def = registry.get(row.type);
  if (!def) {
    row.status = "failed";
    row.updatedAt = Date.now();
    kv.set(`job:${row.id}`, JSON.stringify(row));
    await jobEvents.emit("job:failed", {
      jobId: row.id,
      type: row.type,
      error: new Error("Unknown task type"),
    });
    return;
  }

  row.status = "running";
  row.updatedAt = Date.now();
  kv.set(`job:${row.id}`, JSON.stringify(row));
  runningJobs.add(row.id);
  await jobEvents.emit("job:start", { jobId: row.id, type: row.type });

  const jobStart = Date.now();
  const controller = new AbortController();
  let ctx: Record<string, unknown> = {};

  try {
    for (let i = row.nextStep; i < def.steps.length; i++) {
      const step = def.steps[i];
      const policy = {
        maxAttempts: 1,
        baseDelayMs: 0,
        ...step.retry,
      } as RetryOptions;
      const runStep = async () => {
        if (step.requiresNetwork) {
          const online = await (effects?.isOnline?.() ?? Promise.resolve(true));
          if (!online)
            throw new AppError("E_NET_OFFLINE", "Offline", step.name);
        }
        const delta = await step.run(
          ctx,
          JSON.parse(row.payload) as Readonly<unknown>,
          {
            signal: controller.signal,
          },
        );
        if (delta && typeof delta === "object") ctx = { ...ctx, ...delta };
      };
      await jobEvents.emit("step:start", {
        jobId: row.id,
        type: row.type,
        step: step.name,
        attempt: 1,
      });
      try {
        await retry(runStep, {
          ...policy,
          isTransient,
          signal: controller.signal,
        });
        row.nextStep = i + 1;
        row.updatedAt = Date.now();
        kv.set(`job:${row.id}`, JSON.stringify(row));
        await jobEvents.emit("step:success", {
          jobId: row.id,
          type: row.type,
          step: step.name,
        });
      } catch (e) {
        row.status = "failed";
        row.updatedAt = Date.now();
        kv.set(`job:${row.id}`, JSON.stringify(row));
        await jobEvents.emit("step:error", {
          jobId: row.id,
          type: row.type,
          step: step.name,
          error: e,
        });
        await jobEvents.emit("job:failed", {
          jobId: row.id,
          type: row.type,
          step: step.name,
          error: e,
        });
        return;
      }

      if (def.jobDeadlineMs && Date.now() - jobStart > def.jobDeadlineMs) {
        controller.abort();
        const e = new AppError("E_UNKNOWN", "Job deadline exceeded", step.name);
        row.status = "failed";
        row.updatedAt = Date.now();
        kv.set(`job:${row.id}`, JSON.stringify(row));
        await jobEvents.emit("job:failed", {
          jobId: row.id,
          type: row.type,
          step: step.name,
          error: e,
        });
        return;
      }
    }

    row.status = "done";
    row.updatedAt = Date.now();
    kv.set(`job:${row.id}`, JSON.stringify(row));
    await jobEvents.emit("job:done", { jobId: row.id, type: row.type });
  } finally {
    runningJobs.delete(row.id);
    gcJobs();
  }
}

// =======================
// 7) SENTRY WIRING
// =======================

// Sentry stub para evitar crashes (sustituir con real en producción)
type SentryScope = {
  setTag?: (key: string, value: string) => void;
  setContext?: (key: string, context: Record<string, unknown>) => void;
  setFingerprint?: (fingerprint: string[]) => void;
};

// Provee tu import real de Sentry
const Sentry = {
  addBreadcrumb: (_: unknown) => void 0,
  captureException: (_e: unknown, _scope?: (s: SentryScope) => SentryScope) =>
    void 0,
  captureMessage: (_m: string, _o?: unknown) => void 0,
};

export function wireSentry(): void {
  jobEvents.on("step:start", (e) => {
    Sentry.addBreadcrumb({
      category: "job",
      level: "info",
      message: "step:start",
      data: e,
    });
  });
  jobEvents.on("step:success", (e) => {
    Sentry.addBreadcrumb({
      category: "job",
      level: "info",
      message: "step:success",
      data: e,
    });
  });
  jobEvents.on("step:error", (e) => {
    const err = (e as { error?: unknown }).error;
    Sentry.addBreadcrumb({
      category: "job",
      level: "error",
      message: "step:error",
      data: {
        type: e.type,
        step: e.step,
        jobId: e.jobId,
        error: asMessage(err),
      },
    });
    Sentry.captureException(err, (scope: SentryScope) => {
      scope.setTag?.("job.type", e.type);
      scope.setTag?.("job.step", e.step);
      scope.setContext?.("job", { jobId: e.jobId });
      scope.setFingerprint?.([e.type, e.step || "unknown"]);
      return scope;
    });
  });
  jobEvents.on("job:failed", (e) => {
    Sentry.captureMessage(`job:failed ${e.type}`, {
      level: "error",
      contexts: { job: { jobId: e.jobId, type: e.type, step: e.step } },
    });
  });
}

// =======================
// 8) IMAGE OPS (Expo ImageManipulator)
// =======================

// Provee tus imports reales desde expo-image-manipulator / expo-file-system
export type ImageManipulatorContext = {
  resize: (o: { width?: number; height?: number }) => void;
  renderAsync: () => Promise<ImageRef>;
  release: () => Promise<void> | void;
};
export type ImageRef = {
  uri: string;
  saveAsync: (o: {
    format: "WEBP" | "PNG" | "JPEG";
    compress?: number;
  }) => Promise<{ uri: string }>;
  release: () => Promise<void> | void;
};
export const ImageManipulator = {
  manipulate: (_uri: string): ImageManipulatorContext => ({
    resize() {},
    renderAsync: async () => ({
      uri: "",
      saveAsync: async () => ({ uri: "" }),
      release() {},
    }),
    release() {},
  }),
};
export const SaveFormat = { WEBP: "WEBP" } as const;

export async function moveAtomic(_from: string, _to: string): Promise<void> {
  /* implementa con expo-file-system */
}

export async function cropAndWebp(
  inputUri: string,
  outUri: string,
  w: number,
  h: number,
  q = 0.8,
): Promise<void> {
  let ctx: ImageManipulatorContext | null = null;
  let img: ImageRef | null = null;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  try {
    timeoutId = setTimeout(() => {
      throw new AppError(
        "E_IMAGE_OOM",
        "Image processing timeout",
        "ImageOps.cropAndWebp",
      );
    }, 15_000);
    ctx = ImageManipulator.manipulate(inputUri);
    ctx.resize({ width: w, height: h });
    img = await ctx.renderAsync();
    const tmp = await img.saveAsync({ format: SaveFormat.WEBP, compress: q });
    await moveAtomic(tmp.uri, outUri);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
    try {
      await img?.release();
    } catch {
    } finally {
      img = null;
    }
    try {
      await ctx?.release();
    } catch {
    } finally {
      ctx = null;
    }
  }
}

// =======================
// 9) GC & BACKGROUND GUARDAS
// =======================

export function gcJobs(maxAgeDays = 7, maxEntries = 500): void {
  const ids = getIndex();
  const now = Date.now();
  const keep: string[] = [];
  for (const id of ids) {
    const s = kv.getString(`job:${id}`);
    if (!s) continue;
    const r = JSON.parse(s) as JobRow;
    const fresh = now - r.updatedAt < maxAgeDays * 86400000;
    if (fresh) keep.push(id);
    else kv.delete(`job:${id}`);
    if (keep.length >= maxEntries) break;
  }
  setIndex(keep);
}

// Provee tus imports reales de expo-background-task / task-manager
const BackgroundTask = {
  isRegisteredAsync: async (_: string) => false,
  registerTaskAsync: async (_: string, __: unknown) => void 0,
};
const BG_TASK_NAME = "minikit-runner";
export async function registerBackgroundRunner(): Promise<void> {
  try {
    const isRegistered = await BackgroundTask.isRegisteredAsync(BG_TASK_NAME);
    if (!isRegistered) {
      await BackgroundTask.registerTaskAsync(BG_TASK_NAME, {
        minimumInterval: 15 * 60,
        networkConnectivityRequired: false,
        requiresExternalPower: false,
      });
    }
  } catch (e) {
    Sentry.addBreadcrumb({
      category: "background",
      level: "warning",
      message: "registerBackgroundRunner failed",
      data: { error: asMessage(e) },
    });
  }
}

// =======================
// 10) PAYLOADS & TASKS CON GUARDS (sin Zod)
// =======================

// Domain payloads
export type SavePayload = {
  classificationId: string;
  baseDir: string;
  sessionId: string;
  data: unknown;
  dbSave?: (p: {
    classificationId: string;
    sessionId: string;
    data: unknown;
  }) => Promise<void>;
};
export type UploadPayload = {
  fileId: string;
  localPath: string;
  endpoint: string;
  chunkSize?: number;
};
export type PdfPayload = {
  outPath: string;
  composeBase64: () => Promise<string>;
};

export function isSavePayload(x: unknown): x is SavePayload {
  if (typeof x !== "object" || x === null) return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.classificationId === "string" &&
    typeof o.baseDir === "string" &&
    typeof o.sessionId === "string"
  );
}
export function isUploadPayload(x: unknown): x is UploadPayload {
  if (typeof x !== "object" || x === null) return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.fileId === "string" &&
    typeof o.localPath === "string" &&
    typeof o.endpoint === "string"
  );
}
export function isPdfPayload(x: unknown): x is PdfPayload {
  if (typeof x !== "object" || x === null) return false;
  const o = x as Record<string, unknown>;
  return typeof o.outPath === "string" && typeof o.composeBase64 === "function";
}

// Ejemplo: Save Classification Task con builder
export function registerSaveClassificationTask(): void {
  const builder = new TaskBuilder("save-classification" as const);

  const def = builder
    .addStep("prepare-staging", async (_ctx, p: unknown) => {
      if (!isSavePayload(p))
        throw new AppError(
          "E_VALIDATION",
          "Invalid save payload",
          "prepare-staging",
        );
      // ensureDir, escribir manifiesto, etc. (omitido aquí)
      return { stagingPath: "/staging/" } as const;
    })
    .addStep(
      "process-images",
      async (ctx, p: unknown) => {
        if (!isSavePayload(p))
          throw new AppError(
            "E_VALIDATION",
            "Invalid save payload",
            "process-images",
          );
        // crop & move usando ctx.stagingPath
        void ctx;
        void p;
        return { processed: true } as const;
      },
      { retry: { ...RETRY_FS } },
    )
    .addStep(
      "commit-db",
      async (_ctx, p: unknown) => {
        if (!isSavePayload(p))
          throw new AppError(
            "E_VALIDATION",
            "Invalid save payload",
            "commit-db",
          );
        if (p.dbSave) {
          const dbSave = p.dbSave; // Capture the function reference
          await retry(
            () =>
              dbSave({
                classificationId: p.classificationId,
                sessionId: p.sessionId,
                data: p.data,
              }),
            RETRY_DB,
          );
        }
        return {} as const;
      },
      { retry: { ...RETRY_DB } },
    )
    .addStep("promote-final", async (ctx) => {
      void ctx; /* mover staging → final */
      return {};
    })
    .build({ jobDeadlineMs: 60_000 });

  registerTask(def);
}

// Ejemplo: Upload Task
export function registerUploadTask(): void {
  const builder = new TaskBuilder("upload-file" as const);

  const def = builder
    .addStep(
      "ensure-session",
      async (_ctx, p: unknown) => {
        if (!isUploadPayload(p))
          throw new AppError(
            "E_VALIDATION",
            "Invalid upload payload",
            "ensure-session",
          );
        // validar archivo local, crear sesión remota, etc.
        void p;
        return { sessionId: "abc" } as const;
      },
      { requiresNetwork: true, retry: { ...RETRY_NET } },
    )
    .addStep(
      "upload-chunks",
      async (ctx, p: unknown) => {
        if (!isUploadPayload(p))
          throw new AppError(
            "E_VALIDATION",
            "Invalid upload payload",
            "upload-chunks",
          );
        // subir en partes con retry
        void ctx;
        void p;
        return {} as const;
      },
      { requiresNetwork: true, retry: { ...RETRY_NET } },
    )
    .addStep(
      "finalize",
      async (ctx, p: unknown) => {
        void ctx;
        if (!isUploadPayload(p))
          throw new AppError(
            "E_VALIDATION",
            "Invalid upload payload",
            "finalize",
          );
        return {};
      },
      { requiresNetwork: true, retry: { ...RETRY_NET } },
    )
    .build({ jobDeadlineMs: 5 * 60_000 });

  registerTask(def);
}

// Ejemplo: PDF Task
export function registerPdfTask(): void {
  const builder = new TaskBuilder("generate-pdf" as const);
  const def = builder
    .addStep(
      "compose",
      async (_ctx, p: unknown) => {
        if (!isPdfPayload(p))
          throw new AppError("E_VALIDATION", "Invalid pdf payload", "compose");
        void p;
        return {};
      },
      { retry: { maxAttempts: 2, baseDelayMs: 300, maxElapsedMs: 15_000 } },
    )
    .build({ jobDeadlineMs: 30_000 });
  registerTask(def);
}

// Ejemplo: Warmup IA Task (NanoRT)
export function registerWarmupTask(): void {
  const builder = new TaskBuilder("warmup-nanort" as const);
  const def = builder
    .addStep(
      "cleanup-tmp",
      async () => {
        /* delete tmp */ return {};
      },
      { retry: { ...RETRY_FS } },
    )
    .addStep(
      "init-nanort",
      async () => {
        try {
          /* import dinámico y initialize */
          return {};
        } catch (e) {
          throw new AppError(
            "E_UNKNOWN",
            `NanoRT import failed: ${asMessage(e)}`,
            "init-nanort",
            e,
          );
        }
      },
      { retry: { maxAttempts: 4, baseDelayMs: 250, maxElapsedMs: 12_000 } },
    )
    .build({ jobDeadlineMs: 25_000 });
  registerTask(def);
}

// =======================
// 11) INTEGRACIÓN DE ALTO NIVEL
// =======================

export function registerAllTasks() {
  registerSaveClassificationTask();
  registerUploadTask();
  registerPdfTask();
  registerWarmupTask();
}

export async function bootstrapMinikit() {
  // Inicializa Sentry wiring, background, etc.
  wireSentry();
  await registerBackgroundRunner();
}
