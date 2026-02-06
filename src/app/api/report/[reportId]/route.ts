import { NextResponse } from "next/server";
import { Container } from "@/backend/config/container";
import { createAuthenticatedClient } from "@/app/api/utils";

// GET /api/report/[reportId] - Get a report by id
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

// PUT /api/report/[reportId] - Update report (tiptap_content)
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ reportId: string }> }
) {
    try {
        const { reportId } = await params;
        const body = await request.json();
        const { tiptap_content, title } = body;

        // Authenticate
        const { user, supabase } = await createAuthenticatedClient();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Build update object
        const updateData: { tiptap_content?: string; title?: string; updated_at: string } = {
            updated_at: new Date().toISOString()
        };
        if (tiptap_content !== undefined) updateData.tiptap_content = tiptap_content;
        if (title !== undefined) updateData.title = title;

        // Update the report
        const { error: updateError } = await supabase
            .from('reports')
            .update(updateData)
            .eq('id', reportId);

        if (updateError) {
            console.error("Report update error:", updateError);
            return NextResponse.json(
                { error: "Failed to update report" },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            message: "Report updated successfully"
        });

    } catch (error: any) {
        console.error("Report Update Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to update report" },
            { status: 500 }
        );
    }
}
