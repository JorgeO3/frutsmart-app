import { isTransient } from "./ErrorTaxonomy";

export const RETRY_FS = {
  max: 3,
  baseMs: 250,
  maxDelayMs: 1500,
  maxElapsedMs: 8000,
};
export const RETRY_DB = {
  max: 5,
  baseMs: 200,
  maxDelayMs: 1500,
  maxElapsedMs: 8000,
};
export const RETRY_NET = {
  max: 8,
  baseMs: 400,
  maxDelayMs: 5000,
  maxElapsedMs: 240000,
};

export const asRetryArgs = (p: {
  max: number;
  baseMs: number;
  maxDelayMs?: number;
  maxElapsedMs?: number;
}) => ({
  maxAttempts: p.max,
  baseDelayMs: p.baseMs,
  maxDelayMs: p.maxDelayMs,
  maxElapsedMs: p.maxElapsedMs,
  isTransient,
});
