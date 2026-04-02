/**
 * Phase 2: Gemini Files API + context caching (Node / Trigger.dev).
 *
 * Slice 2+: `runCaptureTranscribeJob` uploads audio here, creates a cache, runs
 * `transcribeCaptureSessionAudio` (and per-photo probes), then deletes file + cache in `finally`.
 * Uses the same API key as {@link ModelStrategy} (`GOOGLE_API_KEY`).
 */
import fs from "fs/promises";
import os from "os";
import path from "path";
import {
  FileState,
  GoogleAICacheManager,
  GoogleAIFileManager,
} from "@google/generative-ai/server";
import { logger } from "@/lib/logger";

/** Model id for cached audio (SDK adds `models/` prefix if missing). */
export const GEMINI_CACHED_AUDIO_MODEL = "gemini-3.1-flash-lite-preview";

/** Default TTL for cached content (1 hour). */
export const DEFAULT_CACHE_TTL_SECONDS = 3600;

export type UploadedGeminiFile = {
  name: string;
  uri: string;
  mimeType: string;
};

/** Full API payload from `GoogleAICacheManager.create` (required for `getGenerativeModelFromCachedContent`). */
export type CachedContentApiResponse = Record<string, unknown> & {
  name: string;
  model: string;
};

export function getGoogleApiKey(): string {
  const key = process.env.GOOGLE_API_KEY;
  if (!key?.trim()) {
    throw new Error("GOOGLE_API_KEY is not set (required for Gemini Files API and caching)");
  }
  return key.trim();
}

/**
 * Write a buffer to a unique file under `os.tmpdir()` (required for GoogleAIFileManager.uploadFile).
 */
export async function writeBufferToTempFile(buffer: Buffer, ext: string): Promise<string> {
  const safeExt = ext.startsWith(".") ? ext : `.${ext}`;
  const base = `capture-audio-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const filePath = path.join(os.tmpdir(), `${base}${safeExt}`);
  await fs.writeFile(filePath, buffer);
  return filePath;
}

export async function removeLocalFileIfExists(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch {
    /* ignore */
  }
}

/**
 * Upload a local file to Gemini Files; returns metadata including `uri` for caching.
 */
export async function uploadLocalAudioToGoogleFiles(
  apiKey: string,
  localPath: string,
  mimeType: string,
  displayName?: string,
): Promise<UploadedGeminiFile> {
  const fileManager = new GoogleAIFileManager(apiKey);
  const upload = await fileManager.uploadFile(localPath, {
    mimeType,
    displayName: displayName ?? path.basename(localPath),
  });
  const file = upload.file;
  if (!file.name || !file.uri) {
    throw new Error("Google uploadFile returned unexpected payload (missing name or uri)");
  }
  return {
    name: file.name,
    uri: file.uri,
    mimeType: file.mimeType ?? mimeType,
  };
}

/**
 * Poll until the uploaded file is ACTIVE (required before creating a context cache).
 */
export async function waitForGeminiFileActive(
  apiKey: string,
  fileName: string,
  options?: { timeoutMs?: number; pollMs?: number },
): Promise<void> {
  const timeoutMs = options?.timeoutMs ?? 180_000;
  const pollMs = options?.pollMs ?? 2000;
  const fileManager = new GoogleAIFileManager(apiKey);
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const meta = await fileManager.getFile(fileName);
    const state = meta.state as string | undefined;
    if (state === FileState.ACTIVE) return;
    if (state === FileState.FAILED) {
      throw new Error(`Gemini file processing failed: ${fileName}`);
    }
    await new Promise((r) => setTimeout(r, pollMs));
  }
  throw new Error(`Timed out waiting for Gemini file to become ACTIVE: ${fileName}`);
}

/**
 * Create a context cache pointing at the uploaded file (single user turn with fileData).
 */
export async function createContextCacheFromFile(
  apiKey: string,
  uploaded: UploadedGeminiFile,
  options?: {
    model?: string;
    ttlSeconds?: number;
    displayName?: string;
  },
): Promise<CachedContentApiResponse> {
  const cacheManager = new GoogleAICacheManager(apiKey);
  const model = options?.model ?? GEMINI_CACHED_AUDIO_MODEL;
  const ttlSeconds = options?.ttlSeconds ?? DEFAULT_CACHE_TTL_SECONDS;

  const cached = await cacheManager.create({
    model,
    displayName: options?.displayName ?? `capture-cache-${Date.now()}`,
    ttlSeconds,
    contents: [
      {
        role: "user",
        parts: [
          {
            fileData: {
              fileUri: uploaded.uri,
              mimeType: uploaded.mimeType,
            },
          },
        ],
      },
    ],
  });

  const record = cached as { name?: string; model?: string };
  if (!record.name || !record.model) {
    throw new Error("Google cache create returned no name or model");
  }
  return cached as unknown as CachedContentApiResponse;
}

export async function deleteGeminiFile(apiKey: string, fileName: string): Promise<void> {
  try {
    const fileManager = new GoogleAIFileManager(apiKey);
    await fileManager.deleteFile(fileName);
  } catch (e) {
    logger.warn("[gemini-files-cache] deleteGeminiFile failed (non-fatal)", { fileName, e });
  }
}

export async function deleteContextCache(apiKey: string, cacheResourceName: string): Promise<void> {
  try {
    const cacheManager = new GoogleAICacheManager(apiKey);
    await cacheManager.delete(cacheResourceName);
  } catch (e) {
    logger.warn("[gemini-files-cache] deleteContextCache failed (non-fatal)", {
      cacheResourceName,
      e,
    });
  }
}
