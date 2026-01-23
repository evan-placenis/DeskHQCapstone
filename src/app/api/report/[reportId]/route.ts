import { NextResponse } from "next/server";
import { Container } from "@/backend/config/container";
import { createAuthenticatedClient } from "@/app/api/utils";
// this is the route for getting a report by id
export async function GET(
    request: Request,
    { params }: { params: Promise<{ reportId: string }> }
) {
    try {
        const { reportId } = await params;

        // Authenticate
        const { user, supabase } = await createAuthenticatedClient();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const reportService = Container.reportService;
        const report = await reportService.getReportById(reportId, supabase);

        if (!report) {
            return NextResponse.json({ error: "Report not found" }, { status: 404 });
        }

        // Transform domain object to match frontend expectations (snake_case)
        const response = {
            id: report.reportId,
            title: report.title,
            tiptap_content: report.tiptapContent || null, // Transform camelCase to snake_case
            project_id: report.projectId,
            status: report.status,
            updated_at: report.updatedAt.toISOString(),
            created_at: report.createdAt.toISOString(),
            template_id: report.templateId,
            version_number: report.versionNumber,
            created_by: report.createdBy,
            // Include all fields for ReportHeader
        };

        return NextResponse.json(response);

    } catch (error: any) {
        console.error("Get Report Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to fetch report" },
            { status: 500 }
        );
    }
}

