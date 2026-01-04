import { NextResponse } from "next/server";
import {Container} from '@/backend/config/container'

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { projectId, reportType, modelName, modeName, selectedImageIds, templateId } = body;
    const reportService = Container.reportService


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
      modelName,
      modeName,
      selectedImageIds: selectedImageIds || [],
      templateId
    });

    return NextResponse.json(newReport, { status: 201 });

  } catch (error: any) {
    console.error("❌ Generate Route Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate report" },
      { status: 500 }
    );
  }
}