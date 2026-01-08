import { NextResponse } from "next/server";
import {Container} from '@/backend/config/container'
import { createAuthenticatedClient } from "@/app/api/utils";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { projectId, reportType, reportWorkflow, modelName, modeName, selectedImageIds, templateId, sections } = body;
    const reportService = Container.reportService

    // Authenticate
    const { supabase, user } = await createAuthenticatedClient();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Validation
    if (!projectId || !reportType) {
      return NextResponse.json(
        { error: "Missing required fields: projectId and reportType are required" },
        { status: 400 }
      );
    }

    // 🚀 Call the Service
    const newReport = await reportService.generateNewReport(projectId, {
      reportType,
      reportWorkflow: reportWorkflow || 'ASSEMBLY', // Default to AUTHOR if missing
      modelName: modelName || 'GROK',
      modeName,
      selectedImageIds: selectedImageIds || [],
      templateId,
      sections // Pass custom sections
    }, supabase);

    // Return the generated report ID so frontend can redirect
    return NextResponse.json({ 
        message: "Report generated successfully",
        reportId: newReport.reportId,
        projectId 
    }, { status: 200 });

        // // 🚀 Background Job (Trigger.dev)  WILL USE LATER ONCE DEPLOYED
    // // Instead of waiting for the report to generate (which can timeout Vercel),
    // // we queue it and return "Pending" immediately.
    
    // await Container.jobQueue.enqueueReportGeneration(
    //     projectId, 
    //     user.id, 
    //     {
    //       reportType,
    //       modelName,
    //       modeName,
    //       selectedImageIds: selectedImageIds || [],
    //       templateId
    //     }
    // );

    // return NextResponse.json({ 
    //     message: "Report generation started in background",
    //     status: "QUEUED",
    //     projectId 
    // }, { status: 202 });

  } catch (error: any) {
    console.error("❌ Generate Route Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate report" },
      { status: 500 }
    );
  }
}
