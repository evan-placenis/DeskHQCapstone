import type { SupabaseClient } from "@supabase/supabase-js";
import {
  describePhotoFromCachedAudio,
  transcribeCaptureSessionAudio,
} from "@/features/ai/services/audio/capture-audio-transcription";
import {
  createContextCacheFromFile,
  deleteContextCache,
  deleteGeminiFile,
  getGoogleApiKey,
  removeLocalFileIfExists,
  type CachedContentApiResponse,
  type UploadedGeminiFile,
  uploadLocalAudioToGoogleFiles,
  waitForGeminiFileActive,
  writeBufferToTempFile,
} from "@/features/ai/services/audio/gemini-files-cache";
import { serializeTranscriptForDb } from "@/features/capture/lib/transcript-payload";
import { logger } from "@/lib/logger";

export const PROJECT_AUDIO_BUCKET = "project-audio";
/** Gallery bucket (`storage-service` / `project_images.storage_path`). */
export const PROJECT_IMAGES_BUCKET = "project-images";

function resolveAudioEndSeconds(
  durationSeconds: number | null,
  segments: { timestampMs: number }[],
  lastPhotoTakenAtMs: number,
): number {
  if (durationSeconds != null && Number.isFinite(durationSeconds) && durationSeconds > 0) {
    return durationSeconds;
  }
  if (segments.length > 0) {
    const lastMs = segments[segments.length - 1].timestampMs;
    return Math.max(1, Math.ceil(lastMs / 1000) + 2);
  }
  return Math.max(1, lastPhotoTakenAtMs / 1000 + 60);
}

/** Dynamic window: photo i gets audio from previous shutter (or 0) to next shutter (or end of recording). */
function probeWindowSeconds(
  i: number,
  rows: { taken_at_ms: number }[],
  audioEndSec: number,
): { startSec: number; endSec: number } {
  const startSec = i === 0 ? 0 : rows[i - 1].taken_at_ms / 1000;
  let endSec = i === rows.length - 1 ? audioEndSec : rows[i + 1].taken_at_ms / 1000;
  if (endSec <= startSec) {
    endSec = Math.min(audioEndSec, startSec + 1);
  }
  return { startSec, endSec };
}

async function downloadProjectImageForProbe(
  admin: SupabaseClient,
  storagePath: string,
  mimeFromDb: string | null,
): Promise<{ mimeType: string; base64: string }> {
  const { data: blob, error } = await admin.storage
    .from(PROJECT_IMAGES_BUCKET)
    .download(storagePath);
  if (error || !blob) {
    throw new Error(error?.message ?? "Failed to download project image for probe");
  }
  const buf = Buffer.from(await blob.arrayBuffer());
  const mimeType =
    typeof mimeFromDb === "string" && mimeFromDb.length > 0
      ? mimeFromDb
      : typeof blob.type === "string" && blob.type.length > 0
        ? blob.type
        : "image/jpeg";
  return { mimeType, base64: buf.toString("base64") };
}

export function expectedTempAudioPath(
  organizationId: string,
  projectId: string,
  sessionId: string,
): string {
  return `${organizationId}/${projectId}/temp/${sessionId}/audio.webm`;
}

/** Bounded parallelism for per-photo Gemini probes (rate limits + many photos). */
export function photoProbeConcurrency(totalPhotos: number): number {
  if (totalPhotos <= 0) return 0;
  if (totalPhotos <= 5) return totalPhotos;
  if (totalPhotos <= 20) return 5;
  if (totalPhotos <= 50) return 6;
  return 4;
}

/**
 * Parallel pool with per-item try/catch → PromiseSettledResult[] (order preserved).
 */
async function mapWithConcurrencySettled<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  if (items.length === 0) return [];
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      try {
        const value = await fn(items[i], i);
        results[i] = { status: "fulfilled", value };
      } catch (reason) {
        results[i] = { status: "rejected", reason };
      }
    }
  }
  const pool = Math.min(Math.max(1, concurrency), items.length);
  await Promise.all(Array.from({ length: pool }, () => worker()));
  return results;
}

export type CaptureTranscribeJobPayload = {
  sessionId: string;
  storagePath: string;
  projectImageIds?: string[];
};

export type CaptureTranscribeJobResult = {
  sessionId: string;
  segmentCount: number;
  durationSeconds: number | null;
  summaryChars: number;
  referencedImageIds: number;
  tempAudioDeleted: boolean;
  photoProbesOk?: number;
  photoProbesFailed?: number;
};

const MAX_TRANSCRIPTION_ERROR_CHARS = 4000;

/**
 * Persist terminal transcription failure for Realtime/UI (called from Trigger task catch).
 */
export async function persistTranscriptionFailure(
  admin: SupabaseClient,
  sessionId: string,
  error: unknown,
): Promise<string> {
  const raw = error instanceof Error ? error.message : String(error);
  const transcription_error =
    raw.length > MAX_TRANSCRIPTION_ERROR_CHARS
      ? `${raw.slice(0, MAX_TRANSCRIPTION_ERROR_CHARS)}…`
      : raw;

  const { error: upErr } = await admin
    .from("capture_sessions")
    .update({
      transcription_status: "failed",
      transcription_error,
    })
    .eq("id", sessionId);

  if (upErr) {
    logger.error("[transcribe-job] Failed to persist transcription failure row:", upErr);
  }

  return transcription_error;
}

/**
 * Download temp audio → Gemini Files + cache → master transcript + per-photo probes → DB → purge storage.
 * Runs inside Trigger.dev (no Next.js request context).
 */
export async function runCaptureTranscribeJob(
  admin: SupabaseClient,
  payload: CaptureTranscribeJobPayload,
): Promise<CaptureTranscribeJobResult> {
  const { sessionId, storagePath, projectImageIds = [] } = payload;

  const { data: session, error: sessionErr } = await admin
    .from("capture_sessions")
    .select("id, organization_id, project_id, folder_name")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionErr || !session) {
    throw new Error(sessionErr?.message || "Capture session not found");
  }

  const projectId = session.project_id as string | undefined;
  const organizationId = session.organization_id as string;
  const folderName = session.folder_name as string;

  if (!projectId) {
    throw new Error("Session not finalized with a project");
  }

  const expected = expectedTempAudioPath(organizationId, projectId, sessionId);
  if (storagePath !== expected) {
    logger.warn("[transcribe-job] Path mismatch", { storagePath, expected });
    throw new Error("Invalid storage path for this session");
  }

  const { data: fileBlob, error: downloadError } = await admin.storage
    .from(PROJECT_AUDIO_BUCKET)
    .download(storagePath);

  if (downloadError || !fileBlob) {
    logger.error("[transcribe-job] Download failed:", downloadError);
    throw new Error(downloadError?.message || "Failed to download audio for transcription");
  }

  const arrayBuffer = await fileBlob.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const mimeType =
    typeof fileBlob.type === "string" && fileBlob.type.length > 0 ? fileBlob.type : "audio/webm";

  logger.info("[transcribe-job] audio ready", {
    sessionId,
    projectId,
    bytes: buffer.length,
    mimeType,
  });

  const apiKey = getGoogleApiKey();
  let tempPath: string | null = null;
  let uploaded: UploadedGeminiFile | null = null;
  let cached: CachedContentApiResponse | null = null;
  let photoProbesOk = 0;
  let photoProbesFailed = 0;

  try {
    tempPath = await writeBufferToTempFile(buffer, "webm");
    uploaded = await uploadLocalAudioToGoogleFiles(apiKey, tempPath, mimeType, `capture-${sessionId}`);
    await waitForGeminiFileActive(apiKey, uploaded.name);
    await removeLocalFileIfExists(tempPath);
    tempPath = null;

    cached = await createContextCacheFromFile(apiKey, uploaded, {
      displayName: `capture-session-${sessionId}`,
    });

    logger.info("[transcribe-job] Gemini Files + context cache ready", {
      sessionId,
      geminiFileName: uploaded.name,
      cacheName: cached.name,
      cacheModel: cached.model,
    });

    const result = await transcribeCaptureSessionAudio(cached, {
      projectImageIds: projectImageIds.length > 0 ? projectImageIds : undefined,
    });

    const { segments, durationSeconds, summary_note, referenced_images } = result;

    const { data: sessionImages, error: siErr } = await admin
      .from("capture_session_images")
      .select("project_image_id, taken_at_ms")
      .eq("capture_session_id", sessionId);

    if (siErr) {
      logger.warn("[transcribe-job] capture_session_images query failed", siErr);
    }

    const probeRows = (sessionImages ?? [])
      .filter(
        (r: { project_image_id?: string; taken_at_ms?: number }) =>
          typeof r.project_image_id === "string" && typeof r.taken_at_ms === "number",
      )
      .sort(
        (a: { taken_at_ms: number }, b: { taken_at_ms: number }) => a.taken_at_ms - b.taken_at_ms,
      ) as { project_image_id: string; taken_at_ms: number }[];

    const conc = photoProbeConcurrency(probeRows.length);
    const lastTakenMs =
      probeRows.length > 0 ? probeRows[probeRows.length - 1].taken_at_ms : 0;
    const audioEndSec = resolveAudioEndSeconds(durationSeconds, segments, lastTakenMs);

    const imageIds = probeRows.map((r) => r.project_image_id);
    const { data: imageMetaRows, error: metaErr } =
      imageIds.length > 0
        ? await admin
            .from("project_images")
            .select("id, storage_path, mime_type")
            .eq("project_id", projectId)
            .eq("folder_name", folderName)
            .in("id", imageIds)
        : { data: [], error: null };

    if (metaErr) {
      logger.warn("[transcribe-job] project_images metadata query failed", metaErr);
    }

    const imageMetaById = new Map<
      string,
      { storage_path: string; mime_type: string | null }
    >(
      (imageMetaRows ?? []).map(
        (r: { id: string; storage_path: string; mime_type: string | null }) => [
          r.id,
          { storage_path: r.storage_path, mime_type: r.mime_type },
        ],
      ),
    );

    const probeItems = probeRows.map((row, i) => ({
      project_image_id: row.project_image_id,
      taken_at_ms: row.taken_at_ms,
      window: probeWindowSeconds(i, probeRows, audioEndSec),
    }));

    logger.info("[transcribe-job] temporal photo probes", {
      sessionId,
      photoCount: probeRows.length,
      concurrency: conc,
      cacheName: cached.name,
      audioEndSec,
    });

    if (probeRows.length > 0 && conc > 0) {
      const settled = await mapWithConcurrencySettled(probeItems, conc, async (item) => {
        const meta = imageMetaById.get(item.project_image_id);
        if (!meta?.storage_path) {
          throw new Error(`Missing project_images row or storage_path for ${item.project_image_id}`);
        }
        const image = await downloadProjectImageForProbe(
          admin,
          meta.storage_path,
          meta.mime_type,
        );
        const description = await describePhotoFromCachedAudio(
          cached!,
          item.project_image_id,
          item.window,
          image,
        );
        return { projectImageId: item.project_image_id, description };
      });

      for (let i = 0; i < settled.length; i++) {
        const r = settled[i];
        if (r.status === "rejected") {
          photoProbesFailed++;
          logger.warn("[transcribe-job] photo probe rejected", {
            sessionId,
            index: i,
            reason: r.reason,
          });
          continue;
        }
        const { projectImageId, description } = r.value;
        if (!description.trim()) {
          photoProbesFailed++;
          continue;
        }
        const { error: upErr } = await admin
          .from("project_images")
          .update({ ai_description: description })
          .eq("id", projectImageId)
          .eq("project_id", projectId)
          .eq("folder_name", folderName);

        if (upErr) {
          photoProbesFailed++;
          logger.error("[transcribe-job] ai_description update failed", { projectImageId, error: upErr });
        } else {
          photoProbesOk++;
        }
      }

      logger.info("[transcribe-job] photo probes done", {
        sessionId,
        photoProbesOk,
        photoProbesFailed,
      });
    }

    const transcriptJson = serializeTranscriptForDb({
      segments,
      summary_note,
      referenced_images,
    });

    logger.info("[transcribe-job] STT result (before DB)", {
      sessionId,
      segmentCount: segments.length,
      durationSeconds,
      summaryChars: summary_note.length,
      referencedImageIds: referenced_images.length,
      payloadBytes: transcriptJson.length,
    });

    const { error: updateError } = await admin
      .from("capture_sessions")
      .update({
        transcript_text: transcriptJson,
        transcription_status: "ready",
        transcription_error: null,
        audio_storage_path: null,
        audio_public_url: null,
        ...(durationSeconds != null && Number.isFinite(durationSeconds) && durationSeconds > 0
          ? { audio_duration_seconds: durationSeconds }
          : {}),
      })
      .eq("id", sessionId);

    if (updateError) {
      logger.error("[transcribe-job] DB update failed after STT (audio not deleted):", updateError);
      throw new Error(updateError.message || "Failed to save transcript");
    }

    const { error: removeError } = await admin.storage.from(PROJECT_AUDIO_BUCKET).remove([storagePath]);
    if (removeError) {
      logger.error("[transcribe-job] Storage delete failed after successful DB write:", removeError);
      return {
        sessionId,
        segmentCount: segments.length,
        durationSeconds,
        summaryChars: summary_note.length,
        referencedImageIds: referenced_images.length,
        tempAudioDeleted: false,
        photoProbesOk,
        photoProbesFailed,
      };
    }

    logger.info("[transcribe-job] complete", {
      sessionId,
      transcriptSaved: true,
      tempAudioDeleted: true,
      photoProbesOk,
      photoProbesFailed,
    });

    return {
      sessionId,
      segmentCount: segments.length,
      durationSeconds,
      summaryChars: summary_note.length,
      referencedImageIds: referenced_images.length,
      tempAudioDeleted: true,
      photoProbesOk,
      photoProbesFailed,
    };
  } finally {
    if (cached) await deleteContextCache(apiKey, cached.name);
    if (uploaded) await deleteGeminiFile(apiKey, uploaded.name);
    if (tempPath) await removeLocalFileIfExists(tempPath);
  }
}
