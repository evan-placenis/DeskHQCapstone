// 🆕 NEW Report Generation Route using AI-SDK
import { NextResponse } from "next/server";
import { Container } from "@/backend/config/container";
import { createAuthenticatedClient } from "@/app/api/utils";
import { ReportServiceNew } from '@/backend/Services/ReportService.new';
import { ReportOrchestrator } from '@/backend/AI_Skills/orchestrators/ReportOrchestrator';
import { v4 as uuidv4 } from 'uuid';
import { Report } from '@/backend/domain/reports/report.types';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ projectId: string }> }
) {
    try {
        const { projectId } = await params;
        const body = await request.json();
        const {
            reportType = 'OBSERVATION',
            modelName = 'grok',
            selectedImageIds = [],
            templateId,
            sections = []
        } = body;

        // Authenticate
        const { supabase, user } = await createAuthenticatedClient();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Create new service instance with AI-SDK orchestrator
        const reportOrchestrator = new ReportOrchestrator();
        const reportService = new ReportServiceNew(
            Container.reportRepo,
            Container.projectRepo,
            reportOrchestrator
        );

        // Generate report stream
        const streamResult = await reportService.generateReportStream(
            projectId,
            {
                reportType,
                modelName,
                selectedImageIds,
                templateId,
                sections
            },
            supabase,
            user.id
        );

        // Return the streaming response
        // The frontend will handle the stream and collect the final report structure
        return streamResult.toUIMessageStreamResponse();

    } catch (error: any) {
        console.error("❌ Report Generation Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to generate report" },
            { status: 500 }
        );
    }
}

/**
 * Helper endpoint to save a completed report after streaming
 * Call this from the frontend after collecting the final report structure
 */
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ projectId: string }> }
) {
    try {
        const { projectId } = await params;
        const body = await request.json();
        const { report } = body;

        // Authenticate
        const { supabase, user } = await createAuthenticatedClient();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Create new service instance
        const reportOrchestrator = new ReportOrchestrator();
        const reportService = new ReportServiceNew(
            Container.reportRepo,
            Container.projectRepo,
            reportOrchestrator
        );

        // Ensure report has required fields
        const reportToSave: Report = {
            reportId: report.reportId || uuidv4(),
            projectId: projectId,
            title: report.title || `Report ${new Date().toLocaleDateString()}`,
            reportContent: report.reportContent || [],
            status: report.status || 'DRAFT',
            createdAt: report.createdAt ? new Date(report.createdAt) : new Date(),
            updatedAt: new Date(),
            templateId: report.templateId || null,
            versionNumber: report.versionNumber || 1,
            createdBy: user.id,
            tiptapContent: report.tiptapContent || null,
            isReviewRequired: true
        };

        // Save the report
        const savedReport = await reportService.saveReport(reportToSave, supabase);

        return NextResponse.json({
            success: true,
            report: savedReport
        });

    } catch (error: any) {
        console.error("❌ Save Report Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to save report" },
            { status: 500 }
        );
    }
}
