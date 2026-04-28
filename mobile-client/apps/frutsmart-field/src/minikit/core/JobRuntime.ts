import EventEmitter from "eventemitter3";
import { kv } from "@src/minikit/state/Kv";
import { retry } from "./Retry";
import { isTransient, AppError } from "./ErrorTaxonomy";

export type StepCtx = Record<string, any>;
export type Step = {
  name: string;
  run: (
    ctx: StepCtx,
    payload: any,
    tools: { signal?: AbortSignal },
  ) => Promise<StepCtx | void>;
  retry?: {
    max: number;
    baseMs: number;
    maxElapsedMs?: number;
    maxDelayMs?: number;
    jitterRatio?: number;
  };
  requiresNetwork?: boolean;
};

export type TaskDef = { type: string; steps: Step[]; jobDeadlineMs?: number };

const registry = new Map<string, TaskDef>();
export const registerTask = (def: TaskDef) => registry.set(def.type, def);

export const jobEvents = new EventEmitter<{
  "job:start": (e: any) => void;
  "job:done": (e: any) => void;
  "job:failed": (e: any) => void;
  "step:start": (e: any) => void;
  "step:success": (e: any) => void;
  "step:error": (e: any) => void;
}>();

// Persistencia MMKV
const JOB_IDX = "jobs:index"; // array de ids

type JobRow = {
  id: string;
  type: string;
  payload: string;
  status: "pending" | "running" | "done" | "failed";
  nextStep: number;
  attempts: number;
  createdAt: number;
  updatedAt: number;
};

function getIndex(): string[] {
  try {
    return JSON.parse(kv.getString(JOB_IDX) ?? "[]");
  } catch {
    return [];
  }
}
function setIndex(ids: string[]) {
  kv.set(JOB_IDX, JSON.stringify(ids));
}

export function enqueueJob(input: { id?: string; type: string; payload: any }) {
  const id =
    input.id ??
    `${input.type}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
  const row: JobRow = {
    id,
    type: input.type,
    payload: JSON.stringify(input.payload),
    status: "pending",
    nextStep: 0,
    attempts: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  kv.set(`job:${id}`, JSON.stringify(row));
  setIndex([...new Set([...getIndex(), id])]);
  return id;
}

let running = false;

export async function runOnce(effects?: { isOnline?: () => Promise<boolean> }) {
  if (running) return;
  running = true;
  try {
    const ids = getIndex();
    const row = ids
      .map((id) => kv.getString(`job:${id}`))
      .map((s) => s && (JSON.parse(s) as JobRow))
      .find((r) => r && (r.status === "pending" || r.status === "running"));
    if (!row) return;

    const def = registry.get(row.type);
    if (!def) {
      row.status = "failed";
      row.updatedAt = Date.now();
      kv.set(`job:${row.id}`, JSON.stringify(row));
      jobEvents.emit("job:failed", {
        jobId: row.id,
        type: row.type,
        error: new Error("Unknown task type"),
      });
      return;
    }

    row.status = "running";
    row.updatedAt = Date.now();
    kv.set(`job:${row.id}`, JSON.stringify(row));
    jobEvents.emit("job:start", { jobId: row.id, type: row.type });

    const jobStart = Date.now();
    const controller = new AbortController();
    let ctx: StepCtx = {};

    for (let i = row.nextStep; i < def.steps.length; i++) {
      const step = def.steps[i];
      const policy = step.retry ?? { max: 1, baseMs: 0 };

      const runStep = async () => {
        if (step.requiresNetwork) {
          const online = await (effects?.isOnline?.() ?? Promise.resolve(true));
          if (!online)
            throw new AppError("E_NET_OFFLINE", "Offline", step.name);
        }
        const delta = await step.run(ctx, JSON.parse(row.payload), {
          signal: controller.signal,
        });
        ctx = { ...ctx, ...(delta ?? {}) };
      };

      jobEvents.emit("step:start", {
        jobId: row.id,
        type: row.type,
        step: step.name,
        attempt: 1,
      });

      try {
        await retry(runStep, {
          maxAttempts: policy.max,
          baseDelayMs: policy.baseMs,
          maxDelayMs: policy.maxDelayMs ?? 5000,
          jitterRatio: policy.jitterRatio ?? 0.3,
          isTransient,
          maxElapsedMs: policy.maxElapsedMs,
          signal: controller.signal,
        });
        row.nextStep = i + 1;
        row.updatedAt = Date.now();
        kv.set(`job:${row.id}`, JSON.stringify(row));
        jobEvents.emit("step:success", {
          jobId: row.id,
          type: row.type,
          step: step.name,
        });
      } catch (e) {
        row.status = "failed";
        row.updatedAt = Date.now();
        kv.set(`job:${row.id}`, JSON.stringify(row));
        jobEvents.emit("step:error", {
          jobId: row.id,
          type: row.type,
          step: step.name,
          error: e,
        });
        jobEvents.emit("job:failed", {
          jobId: row.id,
          type: row.type,
          error: e,
          step: step.name,
        });
        return;
      }

      if (def.jobDeadlineMs && Date.now() - jobStart > def.jobDeadlineMs) {
        controller.abort();
        const e = new AppError("E_UNKNOWN", "Job deadline exceeded", step.name);
        row.status = "failed";
        row.updatedAt = Date.now();
        kv.set(`job:${row.id}`, JSON.stringify(row));
        jobEvents.emit("job:failed", {
          jobId: row.id,
          type: row.type,
          error: e,
          step: step.name,
        });
        return;
      }
    }

    row.status = "done";
    row.updatedAt = Date.now();
    kv.set(`job:${row.id}`, JSON.stringify(row));
    jobEvents.emit("job:done", { jobId: row.id, type: row.type });
  } finally {
    running = false;
  }
}

export async function drain(
  maxJobs = 3,
  effects?: { isOnline?: () => Promise<boolean> },
) {
  for (let i = 0; i < maxJobs; i++) {
    await runOnce(effects);
  }
}
