import { NextResponse } from "next/server";
import { Container } from '@/backend/config/container'
import { createAuthenticatedClient } from "@/app/api/utils";

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { projectId, reportId, sectionId, newContent } = body;
    const reportService = Container.reportService

    // Authenticate
    const { supabase, user } = await createAuthenticatedClient();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Validation
    if (!reportId || !sectionId || !newContent) {
      return NextResponse.json(
        { error: "Missing required fields: reportId, sectionId, and newContent" },
        { status: 400 }
      );
    }

    // ✏️ Call the Service
    // Note: Your service signature asks for projectId, so we pass it here
    await reportService.updateSectionContent(
      projectId,
      reportId,
      sectionId,
      newContent,
      supabase
    );

    return NextResponse.json({ success: true, message: "Section updated" });

  } catch (error: any) {
    console.error("❌ Update Section Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update section" },
      { status: 500 }
    );
  }
}