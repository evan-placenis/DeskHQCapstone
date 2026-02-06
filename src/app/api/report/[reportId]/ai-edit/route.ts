import { NextRequest, NextResponse } from "next/server";
import { streamText } from "ai";
import { ModelStrategy } from "@/backend/AI_Skills/Models/model-strategy";
import { createAuthenticatedClient } from "@/app/api/utils";

/**
 * POST /api/report/[reportId]/ai-edit
 *
 * Client-context AI edit: context comes from the client (Tiptap selection + surrounding).
 * Streams the replacement text only. No DB read for context.
 *
 * Request body:
 * - selection: The highlighted text from the editor (required)
 * - surroundingContext: Optional ~500 chars before/after for flavor
 * - instruction: What the user wants (e.g. "make this concise")
 * - provider: Optional LLM provider (default: gemini-cheap)
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ reportId: string }> }
) {
    try {
        const { reportId } = await params;
        const body = await request.json();
        const { selection, surroundingContext, instruction, provider = "gemini-cheap" } = body;

        const { user } = await createAuthenticatedClient();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (!selection || typeof selection !== "string" || !instruction || typeof instruction !== "string") {
            return NextResponse.json(
                { error: "selection and instruction are required" },
                { status: 400 }
            );
        }

        const systemPrompt = `You are an expert editor helping improve engineering reports.
Your task is to edit the selected text based on the user's instruction.
Keep the same professional tone and technical accuracy.
Return ONLY the replacement text for the selection - no explanations, no markdown code blocks, no preamble.`;

        const userPrompt = surroundingContext
            ? `## Selected text (edit this):
${selection}

## Surrounding context (for flavor only):
${surroundingContext}

## Instruction
${instruction}

## Your task
Return only the edited replacement for the selected text.`
            : `## Selected text (edit this):
${selection}

## Instruction
${instruction}

## Your task
Return only the edited replacement for the selected text.`;

        console.log(`🤖 [AI Edit] Selection-based edit, instruction: "${instruction.slice(0, 60)}..."`);

        const result = streamText({
            model: ModelStrategy.getModel(provider as "grok" | "gemini-pro" | "claude" | "gemini-cheap"),
            system: systemPrompt,
            prompt: userPrompt,
        });

        return result.toTextStreamResponse();
    } catch (error: any) {
        console.error("❌ [AI Edit] Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to generate edit" },
            { status: 500 }
        );
    }
}
