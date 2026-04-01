import { NextResponse } from "next/server";
import { createAuthenticatedClient } from "@/app/api/utils";

type SupabaseFromAuth = Awaited<ReturnType<typeof createAuthenticatedClient>>["supabase"];

async function assertCanEditComment(
  supabase: SupabaseFromAuth,
  userId: string,
  commentId: string
) {
  const { data: row, error: fetchErr } = await supabase
    .from("report_review_comments")
    .select("id, author_id, review_request_id")
    .eq("id", commentId)
    .single();

  if (fetchErr || !row) {
    return { error: "Comment not found" as const, status: 404 as const };
  }

  const { data: reqRow, error: reqErr } = await supabase
    .from("report_review_requests")
    .select("requested_by, assigned_to")
    .eq("id", row.review_request_id)
    .single();

  if (reqErr || !reqRow) {
    return { error: "Review request not found" as const, status: 404 as const };
  }

  const canEdit =
    reqRow.assigned_to === userId ||
    reqRow.requested_by === userId ||
    row.author_id === userId;

  if (!canEdit) {
    return { error: "Forbidden" as const, status: 403 as const };
  }

  return { row };
}

/**
 * DELETE /api/report/review-comment/[comment-id]
 * Permanently removes the comment (same auth as PATCH).
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ "comment-id": string }> }
) {
  try {
    const { user, supabase } = await createAuthenticatedClient();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { "comment-id": commentId } = await params;
    const auth = await assertCanEditComment(supabase, user.id, commentId);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { error: delErr } = await supabase.from("report_review_comments").delete().eq("id", commentId);

    if (delErr) {
      console.error("Delete review comment:", delErr);
      return NextResponse.json({ error: delErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("review-comment DELETE:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/report/review-comment/[comment-id]
 * Body: { resolved: boolean }
 * Assigned reviewer (or author) in same org can toggle resolved.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ "comment-id": string }> }
) {
  try {
    const { user, supabase } = await createAuthenticatedClient();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { "comment-id": commentId } = await params;
    const body = await request.json();
    const resolved = typeof body.resolved === "boolean" ? body.resolved : undefined;
    if (resolved === undefined) {
      return NextResponse.json({ error: "resolved (boolean) is required" }, { status: 400 });
    }

    const auth = await assertCanEditComment(supabase, user.id, commentId);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { error: updErr } = await supabase
      .from("report_review_comments")
      .update({ resolved })
      .eq("id", commentId);

    if (updErr) {
      console.error("Patch review comment:", updErr);
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, resolved });
  } catch (err: unknown) {
    console.error("review-comment PATCH:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}
