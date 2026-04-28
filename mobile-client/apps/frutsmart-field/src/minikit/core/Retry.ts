export type RetryOpts = {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs?: number;
  jitterRatio?: number;
  isTransient: (e: unknown) => boolean;
  maxElapsedMs?: number; // deadline por operación
  signal?: AbortSignal;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function retry<T>(
  fn: () => Promise<T>,
  opts: RetryOpts,
): Promise<T> {
  const start = Date.now();
  let attempt = 0;
  let delay = opts.baseDelayMs;

  while (true) {
    if (opts.signal?.aborted) throw new Error("AbortError");
    try {
      return await fn();
    } catch (e) {
      attempt++;
      const transient = opts.isTransient(e);
      const elapsed = Date.now() - start;
      const lastAttempt = attempt >= opts.maxAttempts;
      const timedOut =
        opts.maxElapsedMs !== undefined && elapsed >= opts.maxElapsedMs;
      if (!transient || lastAttempt || timedOut) throw e;

      const jitter = opts.jitterRatio ?? 0.3;
      const base = Math.min(delay, opts.maxDelayMs ?? Number.MAX_SAFE_INTEGER);
      const wait = Math.max(
        0,
        Math.floor(base * (1 + (Math.random() * 2 - 1) * jitter)),
      );
      const timeLeft =
        (opts.maxElapsedMs ?? Number.POSITIVE_INFINITY) - (Date.now() - start);
      await sleep(Math.min(wait, Math.max(0, timeLeft)));
      delay *= 2; // exponencial
    }
  }
}
