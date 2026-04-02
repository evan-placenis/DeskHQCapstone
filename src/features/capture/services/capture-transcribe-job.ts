import type { SupabaseClient } from "@supabase/supabase-js";
import { transcribeCaptureSessionAudio } from "@/features/ai/services/audio/capture-audio-transcription";
import { serializeTranscriptForDb } from "@/features/capture/lib/transcript-payload";
import { logger } from "@/lib/logger";

export const PROJECT_AUDIO_BUCKET = "project-audio";

export function expectedTempAudioPath(
  organizationId: string,
  projectId: string,
  sessionId: string,
): string {
  return `${organizationId}/${projectId}/temp/${sessionId}/audio.webm`;
}

export async function applySummaryToReferencedImages(
  admin: SupabaseClient,
  sessionId: string,
  projectId: string,
  folderName: string,
  summaryNote: string,
  referencedImages: string[],
): Promise<void> {
  const trimmed = summaryNote.trim();
  if (!trimmed || referencedImages.length === 0) return;

  const { data: links, error: linkErr } = await admin
    .from("capture_session_images")
    .select("project_image_id")
    .eq("capture_session_id", sessionId);

  if (linkErr) {
    logger.warn("[transcribe-job] could not load session images for ai_description", linkErr);
    return;
  }

  const linked = new Set(
    (links ?? []).map((r: { project_image_id: string }) => r.project_image_id),
  );

  for (const imageId of referencedImages) {
    if (!linked.has(imageId)) {
      logger.warn("[transcribe-job] skip referenced_images id not linked to session", { sessionId, imageId });
      continue;
    }
    const { error } = await admin
      .from("project_images")
      .update({ ai_description: trimmed })
      .eq("id", imageId)
      .eq("project_id", projectId)
      .eq("folder_name", folderName);

    if (error) {
      logger.error("[transcribe-job] ai_description update failed", { imageId, error });
    }
  }
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
 * Download temp audio → Gemini STT → DB → optional ai_description → purge storage.
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

  const result = await transcribeCaptureSessionAudio(buffer, mimeType, {
    projectImageIds: projectImageIds.length > 0 ? projectImageIds : undefined,
  });

  const { segments, durationSeconds, summary_note, referenced_images } = result;

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

  await applySummaryToReferencedImages(
    admin,
    sessionId,
    projectId,
    folderName,
    summary_note,
    referenced_images,
  );

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
    };
  }

  logger.info("[transcribe-job] complete", {
    sessionId,
    transcriptSaved: true,
    tempAudioDeleted: true,
  });

  return {
    sessionId,
    segmentCount: segments.length,
    durationSeconds,
    summaryChars: summary_note.length,
    referencedImageIds: referenced_images.length,
    tempAudioDeleted: true,
  };
}
