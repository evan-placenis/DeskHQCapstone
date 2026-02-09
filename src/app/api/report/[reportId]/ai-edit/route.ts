import { NextRequest, NextResponse } from "next/server";
import { createAuthenticatedClient } from "@/app/api/utils";
import { Container } from "@/backend/config/container";

/**
 * POST /api/report/[reportId]/ai-edit
 *
 * Selection-based edit only. Body: { selection, surroundingContext?, instruction, provider?, projectId? }.
 * Edit content is provided only by the client (e.g. Tiptap selection); this route and the edit
 * agent do not fetch report content from the DB. With projectId, the edit agent can use
 * research tools (internal knowledge + web) to make fact-based edits. Returns stream of replacement text.
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ reportId: string }> }
) {
    try {
        await params;
        const body = await request.json();
        const {
            selection,
            surroundingContext,
            instruction,
            provider = "gemini-cheap",
            projectId,
        } = body;

        if (!selection || typeof selection !== "string" || !instruction || typeof instruction !== "string") {
            return NextResponse.json(
                { error: "selection and instruction are required" },
                { status: 400 }
            );
        }

        const { user } = await createAuthenticatedClient();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const validProvider = ["grok", "gemini-pro", "claude", "gemini-cheap"].includes(provider)
            ? provider
            : "gemini-cheap";

        const response = await Container.editService.streamSelectionEdit({
            selection,
            surroundingContext: typeof surroundingContext === "string" ? surroundingContext : undefined,
            instruction,
            provider: validProvider,
            projectId: typeof projectId === "string" && projectId.trim() ? projectId.trim() : undefined,
        });

        return response;
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Failed to generate edit";
        console.error("❌ [AI Edit] Error:", error);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
