import type { RunnableConfig } from "@langchain/core/runnables";

const MAX_ATTEMPTS = 3;
/** Base delay before exponential factor (ms). Attempt 2 waits ~500ms, attempt 3 ~1000ms + jitter. */
const BASE_BACKOFF_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Heuristic: retry only when failure looks transient (rate limits, overload, network).
 */
export function isRetryableModelError(error: unknown): boolean {
  if (error == null) return false;
  const msg = error instanceof Error ? error.message : String(error);
  const lower = msg.toLowerCase();
  const any = error as Record<string, unknown>;
  const status = any?.status ?? any?.statusCode ?? any?.code;
  if (status === 429 || status === 502 || status === 503 || status === 504) return true;
  if (typeof status === "string" && ["429", "502", "503", "504"].includes(status)) return true;
  if (lower.includes("429") || lower.includes("rate limit") || lower.includes("too many requests"))
    return true;
  if (lower.includes("503") || lower.includes("502") || lower.includes("504") || lower.includes("unavailable"))
    return true;
  if (lower.includes("econnreset") || lower.includes("etimedout") || lower.includes("econnrefused")) return true;
  if (lower.includes("fetch failed") || lower.includes("network") || lower.includes("socket")) return true;
  if (lower.includes("overloaded") || lower.includes("capacity")) return true;
  return false;
}

type Invokable = {
  invoke(input: unknown, config?: RunnableConfig): Promise<unknown>;
};

/**
 * Invokes a LangChain chat model (or bound tool model) with exponential backoff between retries.
 * Use this instead of raw `.invoke()` so all providers get consistent resilience without
 * wrapping models in RunnableRetry (which would break `.bindTools()`).
 */
export async function invokeWithRetry(
  model: Invokable,
  input: unknown,
  config?: RunnableConfig,
): Promise<unknown> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await model.invoke(input, config);
    } catch (e) {
      lastError = e;
      if (attempt >= MAX_ATTEMPTS || !isRetryableModelError(e)) {
        throw e;
      }
      const exp = BASE_BACKOFF_MS * Math.pow(2, attempt - 1);
      const jitter = Math.floor(Math.random() * 200);
      await sleep(exp + jitter);
    }
  }
  throw lastError;
}
