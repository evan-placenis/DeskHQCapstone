import "@/features/reports/services/trigger/trigger-sentry";
import { task } from "@trigger.dev/sdk/v3";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import {
  runCaptureTranscribeJob,
  persistTranscriptionFailure,
  type CaptureTranscribeJobPayload,
  type CaptureTranscribeJobResult,
} from "@/src/features/capture/services/capture-ai-pipeline-job";
import { logger } from "@/lib/logger";

const envPaths = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "..", ".env"),
  path.resolve(process.cwd(), "..", "..", ".env"),
];

try {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  envPaths.unshift(path.resolve(__dirname, "..", "..", ".env"));
} catch {
  /* ignore */
}

for (const envPath of envPaths) {
  try {
    const result = dotenv.config({ path: envPath });
    if (!result.error && result.parsed) break;
  } catch {
    /* continue */
  }
}

/**
 * Re-throw after DB write so Trigger.dev shows a failed run (stack in dashboard).
 * - NODE_ENV=development: typical local Next.js
 * - CAPTURE_TRANSCRIBE_THROW_ON_ERROR=true: trigger dev worker often uses NODE_ENV=production
 */
function shouldRethrowTranscriptionError(): boolean {
  return (
    process.env.NODE_ENV === "development" ||
    process.env.CAPTURE_TRANSCRIBE_THROW_ON_ERROR === "true"
  );
}

export const transcribeSessionTask = task({
  id: "transcribe-session",
  retry: {
    maxAttempts: 3,
    minTimeoutInMs: 5000,
    factor: 2,
  },
  run: async (
    payload: CaptureTranscribeJobPayload,
  ): Promise<
    | CaptureTranscribeJobResult
    | { ok: false; sessionId: string; error: string; persistedMessage: string }
  > => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    }
    const admin = createClient(url, key);

    try {
      return await runCaptureTranscribeJob(admin, payload);
    } catch (err) {
      const persistedMessage = await persistTranscriptionFailure(admin, payload.sessionId, err);
      logger.error("[transcribe-session] task failed", {
        sessionId: payload.sessionId,
        persistedMessage,
        err,
      });

      if (shouldRethrowTranscriptionError()) {
        throw err;
      }

      return {
        ok: false,
        sessionId: payload.sessionId,
        error: err instanceof Error ? err.message : String(err),
        persistedMessage,
      };
    }
  },
});
