import { NextResponse } from "next/server";
import { createAuthenticatedClient } from "@/app/api/utils";

/**
 * Get report status and plan (for polling)
 * 
 * This endpoint is used by the frontend to poll for report status changes,
 * particularly to detect when the graph has paused for human approval.
 * 
 * This is a backup mechanism in case Supabase Realtime events don't fire.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ reportId: string }> }
) {
  try {
    const { reportId } = await params;

    if (!reportId) {
      return NextResponse.json(
        { error: "reportId is required" },
        { status: 400 }
      );
    }

    // Authenticate
    const { supabase, user } = await createAuthenticatedClient();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch report status and plan from database
    const { data, error } = await supabase
      .from('reports')
      .select('id, status, plan, updated_at')
      .eq('id', reportId)
      .single();

    if (error) {
      console.error('Failed to fetch report status:', error);
      return NextResponse.json(
        { error: "Report not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      reportId: data.id,
      status: data.status,
      plan: data.plan,
      updatedAt: data.updated_at
    });

  } catch (error: any) {
    console.error("❌ Status check error:", error);
    return NextResponse.json(
      { 
        error: "Failed to check report status",
        details: error.message 
      },
      { status: 500 }
    );
  }
}
