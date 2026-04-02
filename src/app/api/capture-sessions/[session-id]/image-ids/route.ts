import { NextResponse } from "next/server";
import { Container } from "@/lib/container";
import { createAuthenticatedClient } from "@/app/api/utils";

/**
 * GET /api/capture-sessions/:sessionId/image-ids
 * Returns project_image UUIDs linked to this capture session (capture order), for passing to transcribe after retries.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ "session-id": string }> },
) {
  try {
    const { "session-id": sessionId } = await params;
    const { supabase, user } = await createAuthenticatedClient();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const session = await Container.captureSessionRepo.getById(sessionId, supabase);
    if (!session) {
      return NextResponse.json({ error: "Capture session not found" }, { status: 404 });
    }
    if (session.created_by !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data, error } = await supabase
      .from("capture_session_images")
      .select("project_image_id")
      .eq("capture_session_id", sessionId)
      .order("taken_at_ms", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const imageIds = (data ?? []).map((row) => row.project_image_id as string);

    return NextResponse.json({ imageIds });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load image ids" },
      { status: 500 },
    );
  }
}
