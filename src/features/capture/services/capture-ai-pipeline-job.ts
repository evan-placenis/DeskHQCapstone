import type { SupabaseClient } from "@supabase/supabase-js";
import { masterTranscribeAudio } from "@/features/ai/services/audio/master-transcribe";
import {
  downscalePhotoToThumb,
  routeTranscriptToPhotos,
  type RouterAssignment,
  type RouterPhotoInput,
} from "@/features/ai/services/audio/transcript-router";
import { describePhotoFromTranscript } from "@/features/ai/services/audio/photo-describer";
import type { HeliconeContextInput } from "@/src/features/ai/services/models/gateway/helicone-context-builder";
import {
  deleteGeminiFile,
  getGoogleApiKey,
  removeLocalFileIfExists,
  type UploadedGeminiFile,
  uploadLocalAudioToGoogleFiles,
  waitForGeminiFileActive,
  writeBufferToTempFile,
} from "@/src/features/ai/services/audio/gemini-files-client";
import {
  serializeTranscriptForDb,
  type RouterAssignmentForDb,
  type TranscriptSegmentForDb,
} from "@/features/capture/lib/transcript-payload";
import { logger } from "@/lib/logger";

export const PROJECT_AUDIO_BUCKET = "project-audio";
/** Gallery bucket (`storage-service` / `project_images.storage_path`). */
export const PROJECT_IMAGES_BUCKET = "project-images";

async function downloadProjectImage(
  admin: SupabaseClient,
  storagePath: string,
  mimeFromDb: string | null,
): Promise<{ mimeType: string; buffer: Buffer }> {
  const { data: blob, error } = await admin.storage
    .from(PROJECT_IMAGES_BUCKET)
    .download(storagePath);
  if (error || !blob) {
    throw new Error(error?.message ?? "Failed to download project image");
  }
  const buf = Buffer.from(await blob.arrayBuffer());
  const mimeType =
    typeof mimeFromDb === "string" && mimeFromDb.length > 0
      ? mimeFromDb
      : typeof blob.type === "string" && blob.type.length > 0
        ? blob.type
        : "image/jpeg";
  return { mimeType, buffer: buf };
}

export function expectedTempAudioPath(
  organizationId: string,
  projectId: string,
  sessionId: string,
): string {
  return `${organizationId}/${projectId}/temp/${sessionId}/audio.webm`;
}

/** Bounded parallelism for per-photo Describer calls (rate limits + many photos). */
export function photoDescriberConcurrency(totalPhotos: number): number {
  if (totalPhotos <= 0) return 0;
  if (totalPhotos <= 5) return totalPhotos;
  if (totalPhotos <= 20) return 5;
  if (totalPhotos <= 50) return 6;
  return 4;
}

/** Parallel pool with per-item try/catch → PromiseSettledResult[] (order preserved). */
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
  /** Optional; reserved for future use. */
  projectImageIds?: string[];
};

export type CaptureTranscribeJobResult = {
  sessionId: string;
  tempAudioDeleted: boolean;
  transcribedSegmentCount: number;
  routedPhotoCount: number;
  describerOk: number;
  describerFailed: number;
};

const MAX_TRANSCRIPTION_ERROR_CHARS = 4000;

/** Persist terminal transcription failure for Realtime/UI (called from Trigger task catch). */
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

function toDbSegments(
  segments: { id: number; text: string; startMs: number; endMs: number }[],
): TranscriptSegmentForDb[] {
  return segments.map((s) => ({
    text: s.text,
    timestampMs: s.startMs,
    endMs: s.endMs,
  }));
}

function toDbAssignments(assignments: RouterAssignment[]): RouterAssignmentForDb[] {
  return assignments.map((a) => ({
    projectImageId: a.projectImageId,
    chunkIds: [...a.chunkIds],
  }));
}

/**
 * Two-pass capture audio pipeline (runs inside Trigger.dev):
 *
 *   Pass 0 — Master transcribe full session audio (Gemini, JSON segments).
 *   Pass 1 — Router: assign transcript chunks to photos via thumbs + JSON.
 *   Pass 2 — Describer: per-photo agentic field note (research tools).
 */
export async function runCaptureTranscribeJob(
  admin: SupabaseClient,
  payload: CaptureTranscribeJobPayload,
): Promise<CaptureTranscribeJobResult> {
  const { sessionId, storagePath } = payload;

  const { data: session, error: sessionErr } = await admin
    .from("capture_sessions")
    .select("id, organization_id, project_id, folder_name, created_by")
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

  const captureHeliconeInput: HeliconeContextInput = {
    userId:
      typeof session.created_by === "string" && session.created_by.trim().length > 0
        ? session.created_by.trim()
        : sessionId,
    organizationId,
    projectId,
    sessionId,
    feature: "capture_photo_describer",
  };

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
  let describerOk = 0;
  let describerFailed = 0;

  try {
    tempPath = await writeBufferToTempFile(buffer, "webm");
    uploaded = await uploadLocalAudioToGoogleFiles(apiKey, tempPath, mimeType, `capture-${sessionId}`);
    await waitForGeminiFileActive(apiKey, uploaded.name);
    await removeLocalFileIfExists(tempPath);
    tempPath = null;

    // ── Pass 0: Master transcript ───────────────────────────────────────
    logger.info("[transcribe-job] starting master transcribe", { sessionId });
    const transcript = await masterTranscribeAudio(apiKey, uploaded);
    logger.info("[transcribe-job] master transcribe ready", {
      sessionId,
      segmentCount: transcript.segments.length,
    });

    {
      const dbSegments = toDbSegments(transcript.segments);
      const initialPayload = serializeTranscriptForDb({
        segments: dbSegments,
        summary_note: transcript.summaryNote,
        referenced_images: [],
        router_assignments: [],
      });
      const { error: t0Err } = await admin
        .from("capture_sessions")
        .update({ transcript_text: initialPayload })
        .eq("id", sessionId);
      if (t0Err) {
        logger.warn("[transcribe-job] persist master transcript failed (continuing)", t0Err);
      }
    }

    // ── Load photos for this session ────────────────────────────────────
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

    // Download all session photo bytes once; reuse for thumbnail (Router) and full image (Describer).
    type LoadedPhoto = {
      project_image_id: string;
      taken_at_ms: number;
      mimeType: string;
      buffer: Buffer;
      thumbBase64: string;
      thumbMimeType: string;
    };
    const loadedPhotos: LoadedPhoto[] = [];
    for (const row of probeRows) {
      const meta = imageMetaById.get(row.project_image_id);
      if (!meta?.storage_path) {
        logger.warn("[transcribe-job] missing storage_path for image (skipped)", {
          projectImageId: row.project_image_id,
        });
        continue;
      }
      try {
        const { mimeType: imgMime, buffer: imgBuffer } = await downloadProjectImage(
          admin,
          meta.storage_path,
          meta.mime_type,
        );
        const thumb = await downscalePhotoToThumb(imgBuffer);
        loadedPhotos.push({
          project_image_id: row.project_image_id,
          taken_at_ms: row.taken_at_ms,
          mimeType: imgMime,
          buffer: imgBuffer,
          thumbBase64: thumb.base64,
          thumbMimeType: thumb.mimeType,
        });
      } catch (err) {
        logger.warn("[transcribe-job] photo download/downscale failed (skipped)", {
          projectImageId: row.project_image_id,
          err,
        });
      }
    }

    // ── Pass 1: Router ──────────────────────────────────────────────────
    let assignments: RouterAssignment[] = [];
    let unassignedChunkIds: number[] = transcript.segments.map((s) => s.id);

    if (loadedPhotos.length > 0) {
      const routerPhotos: RouterPhotoInput[] = loadedPhotos.map((p) => ({
        projectImageId: p.project_image_id,
        takenAtMs: p.taken_at_ms,
        thumbBase64: p.thumbBase64,
        thumbMimeType: p.thumbMimeType,
      }));
      try {
        const routed = await routeTranscriptToPhotos(apiKey, transcript.segments, routerPhotos);
        assignments = routed.assignments;
        unassignedChunkIds = routed.unassignedChunkIds;
        logger.info("[transcribe-job] router done", {
          sessionId,
          assignedPhotoCount: assignments.length,
          unassignedChunkCount: unassignedChunkIds.length,
        });
      } catch (err) {
        logger.error("[transcribe-job] router failed; falling back to empty assignments", err);
        assignments = loadedPhotos.map((p) => ({
          projectImageId: p.project_image_id,
          chunkIds: [],
        }));
        unassignedChunkIds = transcript.segments.map((s) => s.id);
      }
    }

    {
      const dbSegments = toDbSegments(transcript.segments);
      const updatedPayload = serializeTranscriptForDb({
        segments: dbSegments,
        summary_note: transcript.summaryNote,
        referenced_images: loadedPhotos.map((p) => p.project_image_id),
        router_assignments: toDbAssignments(assignments),
      });
      const { error: t1Err } = await admin
        .from("capture_sessions")
        .update({ transcript_text: updatedPayload })
        .eq("id", sessionId);
      if (t1Err) {
        logger.warn("[transcribe-job] persist router assignments failed (continuing)", t1Err);
      }
    }

    // ── Pass 2: Describer ───────────────────────────────────────────────
    if (loadedPhotos.length > 0) {
      const photosById = new Map(loadedPhotos.map((p) => [p.project_image_id, p]));
      const segmentsById = new Map(transcript.segments.map((s) => [s.id, s]));

      const describerItems = assignments.map((a) => ({
        assignment: a,
        photo: photosById.get(a.projectImageId),
      }));

      const conc = photoDescriberConcurrency(describerItems.length);
      logger.info("[transcribe-job] starting describer pass", {
        sessionId,
        photoCount: describerItems.length,
        concurrency: conc,
      });

      const settled = await mapWithConcurrencySettled(describerItems, conc, async (item) => {
        if (!item.photo) {
          throw new Error(`Photo metadata missing for ${item.assignment.projectImageId}`);
        }
        const chunks = item.assignment.chunkIds
          .map((id) => segmentsById.get(id))
          .filter((c): c is NonNullable<typeof c> => c != null);

        const description = await describePhotoFromTranscript({
          projectImageId: item.assignment.projectImageId,
          image: {
            mimeType: item.photo.mimeType,
            base64: item.photo.buffer.toString("base64"),
          },
          transcriptChunks: chunks,
          projectId,
          heliconeInput: captureHeliconeInput,
        });

        return { projectImageId: item.assignment.projectImageId, description };
      });

      for (let i = 0; i < settled.length; i++) {
        const r = settled[i];
        if (r.status === "rejected") {
          describerFailed++;
          logger.warn("[transcribe-job] describer rejected", {
            sessionId,
            index: i,
            reason: r.reason,
          });
          continue;
        }
        const { projectImageId, description } = r.value;
        if (!description.trim()) {
          describerFailed++;
          continue;
        }
        const { error: upErr } = await admin
          .from("project_images")
          .update({ audio_description: description })
          .eq("id", projectImageId)
          .eq("project_id", projectId)
          .eq("folder_name", folderName);

        if (upErr) {
          describerFailed++;
          logger.error("[transcribe-job] audio_description update failed", { projectImageId, error: upErr });
        } else {
          describerOk++;
        }
      }

      logger.info("[transcribe-job] describer done", {
        sessionId,
        describerOk,
        describerFailed,
      });
    }

    // ── Finalize session row ────────────────────────────────────────────
    const { error: updateError } = await admin
      .from("capture_sessions")
      .update({
        transcription_status: "ready",
        transcription_error: null,
      })
      .eq("id", sessionId);

    if (updateError) {
      logger.error("[transcribe-job] DB update failed after probes:", updateError);
      throw new Error(updateError.message || "Failed to mark session ready");
    }

    logger.info("[transcribe-job] complete", {
      sessionId,
      transcribedSegmentCount: transcript.segments.length,
      routedPhotoCount: assignments.length,
      describerOk,
      describerFailed,
      tempAudioDeleted: false,
      audioRetainedInStorage: true,
    });

    return {
      sessionId,
      tempAudioDeleted: false,
      transcribedSegmentCount: transcript.segments.length,
      routedPhotoCount: assignments.length,
      describerOk,
      describerFailed,
    };
  } finally {
    if (uploaded) await deleteGeminiFile(apiKey, uploaded.name);
    if (tempPath) await removeLocalFileIfExists(tempPath);
  }
}
