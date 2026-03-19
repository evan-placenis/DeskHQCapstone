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
        const { user, supabase } = await createAuthenticatedClient();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const report = await Container.reportService.getReportById(reportId, supabase);
        if (!report) {
            return NextResponse.json({ error: "Report not found" }, { status: 404 });
        }
        return NextResponse.json({
            id: report.reportId,
            title: report.title,
            tiptap_content: report.tiptapContent ?? null,
            project_id: report.projectId,
            status: report.status,
            updated_at: report.updatedAt.toISOString(),
            created_at: report.createdAt.toISOString(),
            template_id: report.templateId,
            version_number: report.versionNumber,
            created_by: report.createdBy,
        });
    } catch (error: unknown) {
        console.error("Get Report Error:", error);
        const message = error instanceof Error ? error.message : "Failed to fetch report";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// PUT /api/report/[reportId] - Update report (tiptap_content, title)
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ reportId: string }> }
) {
    try {
        const { reportId } = await params;
        const body = await request.json();
        const { tiptap_content, title } = body;

        const { user, supabase } = await createAuthenticatedClient();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const updates: { tiptap_content?: string; title?: string } = {};
        if (tiptap_content !== undefined) updates.tiptap_content = tiptap_content;
        if (title !== undefined) updates.title = title;
        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ success: true, message: "No updates provided; no changes made." });
        }

        await Container.reportService.updateReport(reportId, updates, supabase);
        return NextResponse.json({ success: true, message: "Report updated successfully" });
    } catch (error: unknown) {
        console.error("Report Update Error:", error);
        if (error instanceof Error && error.message === "Report not found") {
            return NextResponse.json({ error: "Report not found" }, { status: 404 });
        }
        const message = error instanceof Error ? error.message : "Failed to update report";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
