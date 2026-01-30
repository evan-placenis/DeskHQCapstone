// 🆕 NEW Report Generation Route using AI-SDK
import { NextResponse } from "next/server";
import { Container } from "@/backend/config/container";
import { createAuthenticatedClient } from "@/app/api/utils";
import { v4 as uuidv4 } from 'uuid';
import { Report } from '@/backend/domain/reports/report.types';

export async function POST(
    request: Request
) {
    try {
        const body = await request.json();

        // Normalize arrays to ensure they're never undefined
        const photoIds = body.photoIds || [];
        const selectedImageIds = Array.isArray(body.selectedImageIds)
            ? body.selectedImageIds
            : (Array.isArray(photoIds) ? photoIds : []);
        const sections = Array.isArray(body.sections) ? body.sections : [];

        const {
            projectId,
            reportType = 'OBSERVATION',
            modelName = 'grok',
            templateId
        } = body;

        if (!projectId) {
            return NextResponse.json(
                { error: "projectId is required" },
                { status: 400 }
            );
        }

        // Authenticate
        const { supabase, user } = await createAuthenticatedClient();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        console.log("📤 Queuing report generation with:", {
            projectId,
            reportType,
            modelName,
            selectedImageIdsCount: selectedImageIds.length,
            sectionsCount: sections.length,
            templateId
        });

        // Queue the report generation task in Trigger.dev
        // The Trigger.dev task will handle streaming and broadcast updates via Supabase Realtime
        await Container.jobQueue.enqueueReportGeneration(
            projectId,
            user.id,
            {
                reportType,
                modelName: modelName || 'grok',
                selectedImageIds: selectedImageIds,
                templateId: templateId || '',
                sections: sections
            }
        );

        console.log("✅ Report generation queued successfully");

        // Return immediately - the frontend will listen to Supabase Realtime for updates
        return NextResponse.json({
            message: "Report generation started in background",
            status: "QUEUED",
            projectId
        }, { status: 202 });

    } catch (error: any) {
        console.error("❌ Report Generation Error:", error);
        console.error("❌ Error stack:", error.stack);
        console.error("❌ Error details:", {
            message: error.message,
            name: error.name,
            cause: error.cause
        });
        return NextResponse.json(
            {
                error: error.message || "Failed to generate report",
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            },
            { status: 500 }
        );
    }
}

/**
 * Helper endpoint to save a completed report after streaming
 * Call this from the frontend after collecting the final report structure
 */
export async function PUT(
    request: Request
) {
    try {
        const body = await request.json();
        const { projectId, report } = body;

        if (!projectId) {
            return NextResponse.json(
                { error: "projectId is required" },
                { status: 400 }
            );
        }

        // Authenticate
        const { supabase, user } = await createAuthenticatedClient();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Use the service from Container
        const reportService = Container.reportService;

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
