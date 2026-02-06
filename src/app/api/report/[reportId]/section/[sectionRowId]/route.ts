import { NextResponse } from "next/server";
import { createAuthenticatedClient } from "@/app/api/utils";
import { Container } from "@/backend/config/container";

/**
 * PUT /api/report/[reportId]/section/[sectionRowId]
 *
 * Updates a section (by row UUID) and syncs report.tiptap_content.
 * Business logic lives in ReportService.updateSectionAndTiptapContent.
 */
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ reportId: string; sectionRowId: string }> }
) {
    try {
        const { reportId, sectionRowId } = await params;
        const body = await request.json();
        const { content, heading, original_in_tiptap } = body;

        const { user, supabase } = await createAuthenticatedClient();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (!content && !heading) {
            return NextResponse.json(
                { error: "At least content or heading must be provided" },
                { status: 400 }
            );
        }

        const result = await Container.reportService.updateSectionAndTiptapContent(
            reportId,
            sectionRowId,
            {
                content,
                originalInTiptap: original_in_tiptap,
                heading,
            },
            supabase
        );

        return NextResponse.json({
            success: true,
            sectionRowId,
            message: "Section updated successfully",
            ...(result && { tiptap_content: result.tiptap_content }),
        });
    } catch (error: any) {
        console.error("Section Update Error:", error);
        const message = error?.message ?? "Failed to update section";
        const status = message === "Section not found" ? 404 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}
