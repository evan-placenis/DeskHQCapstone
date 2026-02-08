import { NextRequest, NextResponse } from "next/server";
import { streamText, generateText } from "ai";
import { ModelStrategy } from "@/backend/AI_Skills/Models/model-strategy";
import { createAuthenticatedClient } from "@/app/api/utils";

/**
 * POST /api/report/[reportId]/ai-edit
 *
 * Two modes:
 * 1) Selection-based (client context): body has { selection, surroundingContext?, instruction }.
 *    Streams replacement text. No DB read for context.
 * 2) Section-by-name: body has { sectionRowId, instruction }. Reads report + section from DB,
 *    extracts section text, returns JSON suggestion. No DB write — frontend shows modal and
 *    on accept updates state; save is debounced.
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ reportId: string }> }
) {
    try {
        const { reportId } = await params;
        const body = await request.json();
        const {
            selection,
            surroundingContext,
            sectionRowId,
            instruction,
            provider = "gemini-cheap",
        } = body;

        const { user, supabase } = await createAuthenticatedClient();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // ——— Section-by-name: no selection, use sectionRowId ———
        if (sectionRowId && typeof sectionRowId === "string" && instruction) {
            const { data: report, error: reportError } = await supabase
                .from("reports")
                .select("tiptap_content")
                .eq("id", reportId)
                .single();

            if (reportError || !report) {
                return NextResponse.json({ error: "Report not found" }, { status: 404 });
            }

            const fullReportText = report.tiptap_content ?? "";
            if (!fullReportText.trim()) {
                return NextResponse.json(
                    { error: "Report has no content yet." },
                    { status: 400 }
                );
            }

            const { data: section, error: sectionError } = await supabase
                .from("report_sections")
                .select("id, section_id, heading, content")
                .eq("id", sectionRowId)
                .eq("report_id", reportId)
                .single();

            if (sectionError || !section) {
                return NextResponse.json({ error: "Section not found" }, { status: 404 });
            }

            const sectionContent = section.content ?? "";
            const originalText =
                findSectionSubstring(fullReportText, sectionContent) ??
                extractSectionByHeading(fullReportText, section.heading ?? "");

            if (!originalText?.trim()) {
                return NextResponse.json(
                    { error: "Section content not found in report." },
                    { status: 400 }
                );
            }

            const systemPrompt = `You are an expert editor helping improve engineering reports.
Edit the given section based on the user's instruction. Keep the same professional tone and technical accuracy.
Return ONLY the edited text — no explanations, no markdown code blocks, no preamble.`;

            const userPrompt = `## Section: "${section.heading}"

${originalText}

## Instruction
${instruction}

## Your task
Rewrite the section above following the instruction. Return only the edited text.`;

            const result = await generateText({
                model: ModelStrategy.getModel(provider as "grok" | "gemini-pro" | "claude" | "gemini-cheap"),
                system: systemPrompt,
                prompt: userPrompt,
            });

            const suggestedText = result.text.trim();
            if (!suggestedText) {
                return NextResponse.json({ error: "AI returned empty response" }, { status: 500 });
            }

            return NextResponse.json({
                status: "SUCCESS",
                suggestion: {
                    sectionRowId: section.id,
                    sectionId: section.section_id,
                    sectionHeading: section.heading,
                    originalText,
                    suggestedText,
                    reason: instruction,
                    status: "PENDING",
                    fullDocument: fullReportText,
                },
            });
        }

        // ——— Selection-based: require selection + instruction ———
        if (!selection || typeof selection !== "string" || !instruction || typeof instruction !== "string") {
            return NextResponse.json(
                { error: "Either (sectionRowId + instruction) or (selection + instruction) is required" },
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

function findSectionSubstring(fullText: string, sectionContent: string): string | null {
    if (!sectionContent.trim()) return null;
    const variants = [
        sectionContent,
        sectionContent.trim(),
        sectionContent.replace(/\r\n/g, "\n"),
        sectionContent.replace(/\r\n/g, "\n").trim(),
    ];
    for (const v of variants) {
        if (v && fullText.includes(v)) return v;
    }
    return null;
}

function extractSectionByHeading(fullText: string, heading: string): string | null {
    const raw = (heading ?? "").trim();
    if (!raw) return null;
    const normalizedFull = fullText.replace(/\r\n/g, "\n");
    const headingText = raw.replace(/^#+\s*/, "").trim() || raw;
    const escaped = headingText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const headingRegex = new RegExp(`(^|\\n)(#{0,6}\\s*)${escaped}\\s*(?:\\n|\\r\\n)?`, "im");
    const match = normalizedFull.match(headingRegex);
    if (!match) return null;
    const matchStart = normalizedFull.indexOf(match[0]);
    const sectionStart = matchStart + match[1].length;
    const afterStart = normalizedFull.slice(sectionStart + 1);
    const nextHeadingMatch = afterStart.match(/\n#{1,6}\s+/);
    const sectionEnd = nextHeadingMatch
        ? sectionStart + 1 + nextHeadingMatch.index!
        : normalizedFull.length;
    return normalizedFull.slice(sectionStart, sectionEnd);
}
