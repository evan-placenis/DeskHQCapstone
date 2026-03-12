import { NextResponse } from "next/server";
import { Container } from "@/backend/config/container";
import { createAuthenticatedClient } from "@/app/api/utils";

/**
 * POST /api/report/review-request
 * Creates a peer review request. Body: { reportId, assignedToId, notes }
 */
export async function POST(request: Request) {
  try {
    const { user, supabase } = await createAuthenticatedClient();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { reportId, assignedToId, notes } = body;

    if (!reportId || !assignedToId) {
      return NextResponse.json(
        { error: "reportId and assignedToId are required" },
        { status: 400 }
      );
    }

    // Fetch report to get project_id and organization_id
    const { data: report, error: reportError } = await supabase
      .from("reports")
      .select("id, project_id, organization_id, title")
      .eq("id", reportId)
      .single();

    if (reportError || !report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    // Verify requester is in same org
    const userProfile = await Container.userService.getUserProfile(user.id, supabase);
    if (!userProfile?.organization_id || userProfile.organization_id !== report.organization_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Verify assignee is in same org
    const { data: assigneeProfile } = await supabase
      .from("profiles")
      .select("id, full_name, organization_id")
      .eq("id", assignedToId)
      .single();

    if (!assigneeProfile || assigneeProfile.organization_id !== report.organization_id) {
      return NextResponse.json({ error: "Assignee must be in the same organization" }, { status: 400 });
    }

    // // Don't allow self-assignment
    // if (assignedToId === user.id) {
    //   return NextResponse.json({ error: "Cannot assign review to yourself" }, { status: 400 });
    // }

    const requesterName = userProfile.full_name || user.email || "Unknown";

    const { data: inserted, error } = await supabase
      .from("report_review_requests")
      .insert({
        report_id: reportId,
        project_id: report.project_id,
        organization_id: report.organization_id,
        requested_by: user.id,
        assigned_to: assignedToId,
        status: "pending",
        request_notes: notes || null,
      })
      .select("id")
      .single();

    if (error) {
      console.error("Error creating review request:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      id: inserted.id,
      reportId,
      assignedToId,
      assignedToName: assigneeProfile.full_name || "Unknown",
      requestedByName: requesterName,
    });
  } catch (err: any) {
    console.error("Review request error:", err);
    return NextResponse.json({ error: err.message || "Failed to create review request" }, { status: 500 });
  }
}
