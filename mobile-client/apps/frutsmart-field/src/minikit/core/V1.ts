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
  onAny?<K extends keyof E>(
    handler: (event: K, payload: E[K]) => void,
  ): () => void {
    const wrapped = (type: unknown, ev: unknown) => {
      if (typeof type === "string") {
        handler(type as K, ev as E[K]);
      }
    };
    this.ee.on("*", wrapped);
    return () => this.ee.off("*", wrapped);
  }

  clear?(event?: keyof E): void {
    if (event) this.ee.all.delete(event as string);
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
  retry?: {
    maxAttempts?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    jitterRatio?: number;
    maxElapsedMs?: number;
  };
  run: StepRunner<TPayload, TCtxIn, TDelta>;
};

/**
 * Definición declarativa/estática de la tarea (tipos fuertes, compile-time).
 * Útil para construir y validar la composición, pero lo que se registra en runtime
 * es un RuntimeTask (ver más abajo).
 */
export type TaskDef<
  TType extends string,
  TPayload,
  TCtx extends Record<string, unknown>,
> = {
  type: TType;
  steps: ReadonlyArray<StepDef<TPayload, TCtx, Record<string, unknown>>>;
  jobDeadlineMs?: number;
  payloadGuard?: (x: unknown) => x is TPayload;
};

/**
 * Tarea “ejecutable” en runtime (sin genéricos a la vista).
 * Encapsula los genéricos en un closure, para que runOnce no necesite conocer TPayload/TCtx.
 */
export type RuntimeTask = {
  type: string;
  jobDeadlineMs?: number;
  runSteps: (args: {
    row: JobRow;
    payloadJson: string;
    effects?: { isOnline?: () => Promise<boolean> };
    controller: AbortController;
  }) => Promise<"done" | "failed">;
};

type StepAny = StepDef<
  unknown,
  Record<string, unknown>,
  Record<string, unknown>
>;
type EmptyCtx = Record<never, never>;

/**
 * Builder con acumulación de contexto tipado ENTRE steps.
 * build() devuelve un RuntimeTask que captura TPayload/TCtx en su closure.
 */
export class TaskBuilder<
  TType extends string,
  TPayload,
  TCtx extends Record<string, unknown> = EmptyCtx,
> {
  private _steps: StepAny[] = [];
  constructor(private readonly _type: TType) {}

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
    this._steps.push(step as unknown as StepAny);
    return this as unknown as TaskBuilder<TType, TPayload, TCtx & V>;
  }

  /**
   * Genera el RuntimeTask. Aquí se resuelve el parse/guard del payload
   * y se ejecutan los steps con retry/deadline/online checks.
   */
  build(def?: {
    jobDeadlineMs?: number;
    payloadGuard?: (x: unknown) => x is TPayload;
  }): RuntimeTask {
    const taskType = this._type;
    const jobDeadlineMs = def?.jobDeadlineMs;
    const payloadGuard = def?.payloadGuard;

    // materializamos steps con su tipo real (solo interno a este closure)
    const steps = this._steps.slice() as ReadonlyArray<
      StepDef<TPayload, TCtx, Record<string, unknown>>
    >;

    const runSteps: RuntimeTask["runSteps"] = async ({
      row,
      payloadJson,
      effects,
      controller,
    }) => {
      const jobStart = Date.now();
      let ctx = {} as TCtx;

      // Parse + narrow del payload al tipo de la tarea
      const raw = JSON.parse(payloadJson) as unknown;
      const payload: TPayload = payloadGuard
        ? payloadGuard(raw)
          ? raw
          : (() => {
              throw new AppError(
                "E_VALIDATION",
                `Invalid payload for task ${taskType}`,
              );
            })()
        : (raw as TPayload);

      for (let i = row.nextStep; i < steps.length; i++) {
        const step = steps[i];
        const policy = {
          maxAttempts: 1,
          baseDelayMs: 0,
          ...step.retry,
        } as RetryOptions;

        await jobEvents.emit("step:start", {
          jobId: row.id,
          type: taskType,
          step: step.name,
          attempt: 1,
        });

        try {
          await retry(
            async () => {
              if (step.requiresNetwork) {
                const online = await (effects?.isOnline?.() ??
                  Promise.resolve(true));
                if (!online) {
                  throw new AppError("E_NET_OFFLINE", "Offline", step.name);
                }
              }
              const delta = await step.run(
                ctx as Readonly<TCtx>,
                payload as Readonly<TPayload>,
                { signal: controller.signal },
              );
              if (delta && typeof delta === "object") {
                ctx = { ...ctx, ...delta } as TCtx;
              }
            },
            { ...policy, isTransient, signal: controller.signal },
          );

          row.nextStep = i + 1;
          row.updatedAt = Date.now();
          kv.set(`job:${row.id}`, JSON.stringify(row));
          await jobEvents.emit("step:success", {
            jobId: row.id,
            type: taskType,
            step: step.name,
          });
        } catch (e) {
          row.status = "failed";
          row.updatedAt = Date.now();
          kv.set(`job:${row.id}`, JSON.stringify(row));
          await jobEvents.emit("step:error", {
            jobId: row.id,
            type: taskType,
            step: step.name,
            error: e,
          });
          await jobEvents.emit("job:failed", {
            jobId: row.id,
            type: taskType,
            step: step.name,
            error: e,
          });
          return "failed";
        }

        if (jobDeadlineMs && Date.now() - jobStart > jobDeadlineMs) {
          controller.abort();
          const e = new AppError(
            "E_UNKNOWN",
            "Job deadline exceeded",
            step.name,
          );
          row.status = "failed";
          row.updatedAt = Date.now();
          kv.set(`job:${row.id}`, JSON.stringify(row));
          await jobEvents.emit("job:failed", {
            jobId: row.id,
            type: taskType,
            step: step.name,
            error: e,
          });
          return "failed";
        }
      }

      row.status = "done";
      row.updatedAt = Date.now();
      kv.set(`job:${row.id}`, JSON.stringify(row));
      await jobEvents.emit("job:done", { jobId: row.id, type: taskType });
      return "done";
    };

    return { type: taskType, jobDeadlineMs, runSteps };
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

const registry = new Map<string, RuntimeTask>();

export function registerTask(rt: RuntimeTask): void {
  if (registry.has(rt.type)) {
    throw new AppError("E_UNKNOWN", `Task already registered: ${rt.type}`);
  }
  registry.set(rt.type, rt);
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

function safeParseRow(s: string | undefined): JobRow | undefined {
  if (!s) return undefined;
  try {
    const obj = JSON.parse(s) as unknown;
    if (!obj || typeof obj !== "object") return undefined;
    const r = obj as Partial<JobRow>;
    if (
      typeof r.id === "string" &&
      typeof r.type === "string" &&
      typeof r.payload === "string" &&
      typeof r.nextStep === "number" &&
      (r.status === "pending" ||
        r.status === "running" ||
        r.status === "done" ||
        r.status === "failed") &&
      typeof r.createdAt === "number" &&
      typeof r.updatedAt === "number"
    ) {
      return r as JobRow;
    }
  } catch {
    /* ignore */
  }
  return undefined;
}

const runningJobs = new Set<string>();
export const MAX_PARALLEL_JOBS = 1;

export async function runOnce(effects?: {
  isOnline?: () => Promise<boolean>;
}): Promise<void> {
  if (runningJobs.size >= MAX_PARALLEL_JOBS) return;

  const ids = getIndex();
  const row = ids
    .map((id) => safeParseRow(kv.getString(`job:${id}`)))
    .find(
      (r) =>
        r &&
        (r.status === "pending" || r.status === "running") &&
        !runningJobs.has(r.id),
    );
  if (!row) return;

  const rt = registry.get(row.type);
  if (!rt) {
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

  try {
    const controller = new AbortController();
    await rt.runSteps({
      row,
      payloadJson: row.payload,
      effects,
      controller,
    });
  } finally {
    runningJobs.delete(row.id);
    gcJobs();
  }
}

// =======================
// 7) SENTRY WIRING
// =======================

import * as Sentry from "@sentry/react-native";

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
    Sentry.captureException(err, (scope) => {
      scope.setTag("job.type", e.type);
      scope.setTag("job.step", e.step);
      scope.setContext("job", { jobId: e.jobId });
      scope.setFingerprint([e.type, e.step || "unknown"]);
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
  const builder = new TaskBuilder<"save-classification", SavePayload>(
    "save-classification",
  );

  const rt = builder
    .addStep("prepare-staging", async (_ctx, p) => {
      // p ya es SavePayload si payloadGuard pasa
      // ensureDir, escribir manifiesto, etc.
      return { stagingPath: "/staging/" } as const;
    })
    .addStep(
      "process-images",
      async (ctx, p) => {
        // crop & move usando ctx.stagingPath
        void ctx;
        void p;
        return { processed: true } as const;
      },
      { retry: { ...RETRY_FS } },
    )
    .addStep(
      "commit-db",
      async (_ctx, p) => {
        // Captura la ref en una constante para que el narrowing se mantenga dentro del closure
        const dbSave = p.dbSave;
        if (dbSave) {
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
    .build({
      jobDeadlineMs: 60_000,
      payloadGuard: isSavePayload, // <-- ✅ valida una vez y tipa 'p'
    });

  registerTask(rt);
}

// Ejemplo: Upload Task
export function registerUploadTask(): void {
  const builder = new TaskBuilder<"upload-file", UploadPayload>("upload-file");

  const rt = builder
    .addStep(
      "ensure-session",
      async (_ctx, p) => {
        // validar archivo local, crear sesión remota, etc.
        void p;
        return { sessionId: "abc" } as const;
      },
      { requiresNetwork: true, retry: { ...RETRY_NET } },
    )
    .addStep(
      "upload-chunks",
      async (ctx, p) => {
        // subir en partes con retry
        void ctx;
        void p;
        return {} as const;
      },
      { requiresNetwork: true, retry: { ...RETRY_NET } },
    )
    .addStep(
      "finalize",
      async (ctx, p) => {
        void ctx;
        void p;
        return {};
      },
      { requiresNetwork: true, retry: { ...RETRY_NET } },
    )
    .build({
      jobDeadlineMs: 5 * 60_000,
      payloadGuard: isUploadPayload, // <-- ✅
    });

  registerTask(rt);
}

// Ejemplo: PDF Task
export function registerPdfTask(): void {
  const builder = new TaskBuilder<"generate-pdf", PdfPayload>("generate-pdf");

  const rt = builder
    .addStep(
      "compose",
      async (_ctx, p) => {
        // p: PdfPayload
        void p;
        return {};
      },
      { retry: { maxAttempts: 2, baseDelayMs: 300, maxElapsedMs: 15_000 } },
    )
    .build({
      jobDeadlineMs: 30_000,
      payloadGuard: isPdfPayload, // <-- ✅
    });

  registerTask(rt);
}

// Ejemplo: Warmup IA Task (NanoRT)
export function registerWarmupTask(): void {
  type WarmupPayload = { assets: Array<{ from: string; to: string }> };
  const isWarmupPayload = (x: unknown): x is WarmupPayload =>
    typeof x === "object" &&
    x !== null &&
    Array.isArray((x as { assets?: unknown }).assets);

  const builder = new TaskBuilder<"warmup-nanort", WarmupPayload>(
    "warmup-nanort",
  );

  const rt = builder
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
          /* import dinámico y initialize */ return {};
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
    .build({
      jobDeadlineMs: 25_000,
      payloadGuard: isWarmupPayload, // <-- ✅
    });

  registerTask(rt);
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
