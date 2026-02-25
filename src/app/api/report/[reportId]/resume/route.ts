import { NextResponse } from "next/server";
import { createAuthenticatedClient } from "@/app/api/utils";
import { tasks } from "@trigger.dev/sdk/v3";
import type { generateReportTask } from "@/backend/infrastructure/job/trigger/generateReport";

/**
 * Resume a paused LangGraph workflow (Human-in-the-Loop)
 * 
 * This route ONLY dispatches a signal to Trigger.dev to resume the workflow.
 * It does NOT run LangGraph directly (to avoid Vercel timeouts).
 * 
 * Flow:
 * 1. User approves/rejects plan → POST to this endpoint
 * 2. Update DB status to 'GENERATING'
 * 3. Dispatch to Trigger.dev with resume action
 * 4. Return immediately
 * 5. Trigger.dev worker handles the actual graph resume
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ reportId: string }> }
) {
  try {
    const { reportId } = await params;
    const body = await request.json();
    const { approvalStatus, userFeedback, modifiedPlan } = body;

    // 1. Validation
    if (!reportId) {
      return NextResponse.json(
        { error: "reportId is required" },
        { status: 400 }
      );
    }

    if (!approvalStatus || !['APPROVED', 'REJECTED'].includes(approvalStatus)) {
      return NextResponse.json(
        { error: "approvalStatus must be 'APPROVED' or 'REJECTED'" },
        { status: 400 }
      );
    }

    // 2. Authentication
    const { supabase, user } = await createAuthenticatedClient();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log(`🔄 Dispatching resume task for ${reportId} [${approvalStatus}]`);
    if (userFeedback) {
      console.log(`💬 User feedback: ${userFeedback}`);
    }

    // 3. Update database status to GENERATING
    const { error: dbError } = await supabase
      .from('reports')
      .update({ 
        status: 'GENERATING',
        updated_at: new Date().toISOString()
      })
      .eq('id', reportId);

    if (dbError) {
      console.error('Failed to update report status:', dbError);
      return NextResponse.json(
        { error: "Failed to update report status" },
        { status: 500 }
      );
    }

    // 4. Dispatch to Trigger.dev
    // Pass the frontend's plan (edited or not) so the builder uses it directly
    const handle = await tasks.trigger<typeof generateReportTask>("generate-report", {
      reportId: reportId,
      userId: user.id,
      action: "resume",
      approvalStatus: approvalStatus as "APPROVED" | "REJECTED",
      userFeedback: userFeedback || "",
      modifiedPlan: modifiedPlan ?? undefined, // Plan from PlanApprovalModal (possibly user-edited)
    });

    console.log(`✅ Resume task queued: ${handle.id}`);

    // 5. Return success immediately
    // Frontend will detect progress via Supabase Realtime or polling
    return NextResponse.json({ 
      success: true, 
      message: "Resume task queued successfully",
      runId: handle.id,
      reportId: reportId
    });

  } catch (error: any) {
    console.error("❌ Resume dispatch error:", error);
    return NextResponse.json(
      { 
        error: "Failed to queue resume task",
        details: error.message 
      },
      { status: 500 }
    );
  }
}