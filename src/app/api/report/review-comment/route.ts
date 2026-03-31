import { NextResponse } from "next/server";
import { createAuthenticatedClient } from "@/app/api/utils";

/**
 * POST /api/report/review-comment
 * Body: { reviewRequestId, comment, type, highlightedText?, sectionId? }
 * Only the assigned reviewer may add comments.
 */
export async function POST(request: Request) {
  try {
    const { user, supabase } = await createAuthenticatedClient();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { reviewRequestId, comment, type, highlightedText, sectionId } = body as {
      reviewRequestId?: string;
      comment?: string;
      type?: string;
      highlightedText?: string | null;
      sectionId?: string | null;
    };

    if (!reviewRequestId || !comment?.trim() || !type) {
      return NextResponse.json(
        { error: "reviewRequestId, comment, and type are required" },
        { status: 400 }
      );
    }

    if (!["comment", "suggestion", "issue"].includes(type)) {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    const { data: reqRow, error: reqErr } = await supabase
      .from("report_review_requests")
      .select("id, assigned_to, organization_id")
      .eq("id", reviewRequestId)
      .single();

    if (reqErr || !reqRow) {
      return NextResponse.json({ error: "Review request not found" }, { status: 404 });
    }

    if (reqRow.assigned_to !== user.id) {
      return NextResponse.json({ error: "Only the assigned reviewer can comment" }, { status: 403 });
    }

    const { data: inserted, error: insErr } = await supabase
      .from("report_review_comments")
      .insert({
        review_request_id: reviewRequestId,
        author_id: user.id,
        body: comment.trim(),
        type,
        highlighted_text: highlightedText?.trim() || null,
        section_id: sectionId != null ? String(sectionId) : null,
        resolved: false,
      })
      .select("id, created_at")
      .single();

    if (insErr || !inserted) {
      console.error("Insert review comment:", insErr);
      return NextResponse.json(
        { error: insErr?.message || "Failed to save comment" },
        { status: 500 }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();

    return NextResponse.json({
      success: true,
      comment: {
        id: inserted.id,
        userId: user.id,
        userName: profile?.full_name || "Reviewer",
        comment: comment.trim(),
        timestamp: new Date(inserted.created_at).toLocaleString(),
        type,
        highlightedText: highlightedText?.trim() || undefined,
        sectionId: sectionId ?? undefined,
        resolved: false,
      },
    });
  } catch (err: unknown) {
    console.error("review-comment POST:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}
