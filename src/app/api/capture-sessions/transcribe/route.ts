import { NextResponse } from "next/server";
import { tasks } from "@trigger.dev/sdk/v3";
import { Container } from "@/lib/container";
import { createAuthenticatedClient } from "@/app/api/utils";
import { expectedTempAudioPath } from "@/src/features/capture/services/capture-ai-pipeline-job";
import { logger } from "@/lib/logger";

/**
 * POST /api/capture-sessions/transcribe
 * Validates the caller, then queues a Trigger.dev job. Work runs in `transcribe-session`.
 * Body: { sessionId: string, storagePath: string, projectImageIds?: string[] }
 */
export async function POST(request: Request) {
  try {
    const { supabase, user } = await createAuthenticatedClient();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
    const storagePath = typeof body.storagePath === "string" ? body.storagePath.trim() : "";
    const projectImageIds = Array.isArray(body.projectImageIds)
      ? (body.projectImageIds as unknown[]).filter(
          (id): id is string => typeof id === "string" && id.trim().length > 0,
        )
      : [];

    if (!sessionId || !storagePath) {
      return NextResponse.json(
        { error: "sessionId and storagePath are required" },
        { status: 400 },
      );
    }

    const session = await Container.captureSessionRepo.getById(sessionId, supabase);
    if (!session) {
      return NextResponse.json({ error: "Capture session not found" }, { status: 404 });
    }

    if (session.created_by !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const projectId = session.project_id;
    if (!projectId) {
      return NextResponse.json(
        { error: "Session not finalized with a project" },
        { status: 400 },
      );
    }

    const organizationId = session.organization_id;
    const expected = expectedTempAudioPath(organizationId, projectId, sessionId);
    if (storagePath !== expected) {
      logger.warn("[transcribe] Path mismatch", { storagePath, expected });
      return NextResponse.json({ error: "Invalid storage path for this session" }, { status: 400 });
    }

    if (session.transcript_text && String(session.transcript_text).trim().length > 0) {
      return NextResponse.json({
        alreadyComplete: true,
        queued: false,
        runId: null as string | null,
      });
    }

    const { error: statusErr } = await Container.adminClient
      .from("capture_sessions")
      .update({ transcription_status: "queued", transcription_error: null })
      .eq("id", sessionId);
    if (statusErr) {
      logger.warn("[transcribe] Could not set transcription_status=queued", statusErr);
    }

    const handle = await tasks.trigger("transcribe-session", {
      sessionId,
      storagePath,
      ...(projectImageIds.length > 0 ? { projectImageIds } : {}),
    });

    logger.info("[transcribe] task queued", { sessionId, runId: handle.id });

    return NextResponse.json({
      queued: true,
      runId: handle.id,
      alreadyComplete: false,
    });
  } catch (err) {
    logger.error("[transcribe] Unexpected error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to queue transcription" },
      { status: 500 },
    );
  }
}
