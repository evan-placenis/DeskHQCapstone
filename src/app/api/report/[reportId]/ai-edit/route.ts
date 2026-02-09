import { NextRequest, NextResponse } from "next/server";
import { createAuthenticatedClient } from "@/app/api/utils";
import { Container } from "@/backend/config/container";
import { ReportNotFoundError } from "@/backend/Services/EditService";

/**
 * POST /api/report/[reportId]/ai-edit
 *
 * Selection-based edit. Body: { selection, surroundingContext?, instruction, provider? }.
 * All logic (resolve project, run edit) is in EditService.
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ reportId: string }> }
) {
    try {
        const { reportId } = await params;
        const body = await request.json();
        const { selection, surroundingContext, instruction, provider } = body;

        if (!selection || typeof selection !== "string" || !instruction || typeof instruction !== "string") {
            return NextResponse.json(
                { error: "selection and instruction are required" },
                { status: 400 }
            );
        }

        const { user, supabase } = await createAuthenticatedClient();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const response = await Container.editService.streamSelectionEdit(
            reportId,
            { selection, surroundingContext, instruction, provider },
            supabase
        );
        return response;
    } catch (error) {
        if (error instanceof ReportNotFoundError) {
            return NextResponse.json({ error: "Report not found" }, { status: 404 });
        }
        const message = error instanceof Error ? error.message : "Failed to generate edit";
        console.error("❌ [AI Edit] Error:", error);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
