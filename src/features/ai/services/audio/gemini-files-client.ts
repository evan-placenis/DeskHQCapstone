/**
 * Gemini Files API helpers (Node / Trigger.dev).
 *
 * `runCaptureTranscribeJob` uploads audio here for the Master Transcribe pass,
 * then deletes the file in `finally`. Uses `GOOGLE_API_KEY`.
 */
import fs from "fs/promises";
import os from "os";
import path from "path";
import {
  FileState,
  GoogleAIFileManager,
} from "@google/generative-ai/server";
import { logger } from "@/lib/logger";

/** Default Gemini model for capture audio (master transcribe + router). */
export const GEMINI_CACHED_AUDIO_MODEL = "gemini-3.1-flash-lite-preview";

export type UploadedGeminiFile = {
  name: string;
  uri: string;
  mimeType: string;
};

export function getGoogleApiKey(): string {
  const key = process.env.GOOGLE_API_KEY;
  if (!key?.trim()) {
    throw new Error("GOOGLE_API_KEY is not set (required for Gemini Files API)");
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
 * Upload a local file to Gemini Files; returns metadata including `uri` for fileData parts.
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
 * Poll until the uploaded file is ACTIVE (required before referencing it in `generateContent`).
 * Defaults: 10 min timeout, 5 s poll interval — large field recordings can take a while to process.
 */
export async function waitForGeminiFileActive(
  apiKey: string,
  fileName: string,
  options?: { timeoutMs?: number; pollMs?: number },
): Promise<void> {
  const timeoutMs = options?.timeoutMs ?? 600_000;
  const pollMs = options?.pollMs ?? 5000;
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

export async function deleteGeminiFile(apiKey: string, fileName: string): Promise<void> {
  try {
    const fileManager = new GoogleAIFileManager(apiKey);
    await fileManager.deleteFile(fileName);
  } catch (e) {
    logger.warn("[gemini-files-cache] deleteGeminiFile failed (non-fatal)", { fileName, e });
  }
}
