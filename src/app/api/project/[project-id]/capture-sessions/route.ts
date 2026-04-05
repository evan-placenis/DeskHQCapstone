import { NextResponse } from "next/server";
import { Container } from "@/lib/container";
import { createAuthenticatedClient } from "@/app/api/utils";

/**
 * GET /api/project/[project-id]/capture-sessions
 * Returns capture session rows for transcription badges (folder → status).
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ "project-id": string }> },
) {
  try {
    const { supabase, user } = await createAuthenticatedClient();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { "project-id": projectId } = await context.params;
    if (!projectId) {
      return NextResponse.json({ error: "Missing Project ID" }, { status: 400 });
    }

    const isUUID =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId);
    if (!isUUID) {
      return NextResponse.json({ error: "Invalid Project ID format" }, { status: 400 });
    }

    const project = await Container.projectRepo.getById(projectId, supabase);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const sessions = await Container.captureSessionRepo.listByProjectId(projectId, supabase);
    return NextResponse.json({ sessions });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch capture sessions";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
