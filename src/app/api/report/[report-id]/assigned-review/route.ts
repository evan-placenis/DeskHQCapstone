import { NextResponse } from "next/server";
import { Container } from "@/lib/container";
import { createAuthenticatedClient } from "@/app/api/utils";

/**
 * GET /api/report/[reportId]/assigned-review
 * Returns the peer review request for this report assigned to the current user (if any).
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ "report-id": string }> }
) {
  try {
    const { "report-id": reportId } = await params;
    const { user, supabase } = await createAuthenticatedClient();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: review, error } = await supabase
      .from("report_review_requests")
      .select(`
        id,
        report_id,
        request_notes,
        request_date,
        requested_by,
        assigned_to,
        status
      `)
      .eq("report_id", reportId)
      .eq("assigned_to", user.id)
      .eq("status", "pending")
      .single();

    if (error || !review) {
      return NextResponse.json({ review: null });
    }

    // Fetch requester name and project/report info
    const [requesterRes, reportRes] = await Promise.all([
      supabase.from("profiles").select("full_name").eq("id", review.requested_by).single(),
      supabase.from("reports").select("title").eq("id", reportId).single(),
    ]);
    const { data: projectData } = await supabase
      .from("reports")
      .select("project_id")
      .eq("id", reportId)
      .single();
    let projectName = "Unknown Project";
    if (projectData?.project_id) {
      const { data: proj } = await supabase
        .from("projects")
        .select("name")
        .eq("id", projectData.project_id)
        .single();
      projectName = proj?.name || projectName;
    }

    const { data: commentRows, error: commentsErr } = await supabase
      .from("report_review_comments")
      .select(
        "id, author_id, body, type, highlighted_text, section_id, resolved, created_at"
      )
      .eq("review_request_id", review.id)
      .order("created_at", { ascending: true });

    if (commentsErr) {
      console.warn("report_review_comments fetch (run migration if missing):", commentsErr.message);
    }

    const safeRows = commentsErr ? [] : commentRows || [];

    const authorIds = [...new Set(safeRows.map((c: { author_id: string }) => c.author_id))];
    const { data: authorProfiles } =
      authorIds.length > 0
        ? await supabase.from("profiles").select("id, full_name").in("id", authorIds)
        : { data: [] as { id: string; full_name: string | null }[] };

    const nameById = new Map(
      (authorProfiles || []).map((p: { id: string; full_name: string | null }) => [
        p.id,
        p.full_name || "Unknown",
      ])
    );

    const comments = safeRows.map(
      (c: {
        id: string;
        author_id: string;
        body: string;
        type: string;
        highlighted_text: string | null;
        section_id: string | null;
        resolved: boolean;
        created_at: string;
      }) => ({
        id: c.id,
        userId: c.author_id,
        userName: nameById.get(c.author_id) || "Unknown",
        comment: c.body,
        timestamp: new Date(c.created_at).toLocaleString(),
        type: c.type as "comment" | "suggestion" | "issue",
        highlightedText: c.highlighted_text || undefined,
        sectionId: c.section_id || undefined,
        resolved: c.resolved,
      })
    );

    const peerReview = {
      id: review.id,
      reportId: review.report_id,
      reportTitle: reportRes?.data?.title || "Untitled Report",
      projectName,
      requestedById: review.requested_by,
      requestedByName: requesterRes?.data?.full_name || "Unknown",
      assignedToId: review.assigned_to,
      assignedToName: "",
      status: review.status,
      requestDate: review.request_date ? new Date(review.request_date).toISOString().split("T")[0] : "",
      requestNotes: review.request_notes || undefined,
      comments,
    };

    return NextResponse.json({ review: peerReview });
  } catch (err: any) {
    console.error("Assigned review error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
