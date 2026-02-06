import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { ModelStrategy } from "@/backend/AI_Skills/Models/model-strategy";
import { createAuthenticatedClient } from "@/app/api/utils";

/**
 * POST /api/report/[reportId]/ai-edit
 * 
 * Non-streaming AI edit endpoint. Uses generateText instead of streamText
 * to avoid the streaming JSON order issue with tool calls.
 * 
 * Request body:
 * - sectionRowId: UUID of the section to edit
 * - instruction: What the user wants to do (e.g., "make it more concise")
 * - provider: Optional LLM provider (default: gemini-cheap)
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ reportId: string }> }
) {
    try {
        const { reportId } = await params;
        const body = await request.json();
        const { sectionRowId, instruction, provider = 'gemini-cheap' } = body;

        // Authenticate
        const { user, supabase } = await createAuthenticatedClient();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Validate required fields
        if (!sectionRowId || !instruction) {
            return NextResponse.json(
                { error: "sectionRowId and instruction are required" },
                { status: 400 }
            );
        }

        // Fetch report tiptap_content (single source of truth for displayed text)
        const { data: report, error: reportError } = await supabase
            .from('reports')
            .select('tiptap_content')
            .eq('id', reportId)
            .single();

        if (reportError || !report) {
            return NextResponse.json(
                { error: "Report not found" },
                { status: 404 }
            );
        }

        const fullReportText = report.tiptap_content ?? '';
        if (!fullReportText.trim()) {
            return NextResponse.json(
                { error: "Report has no content yet. Add or generate content before requesting edits." },
                { status: 400 }
            );
        }

        // Fetch the section from report_sections (for heading and to locate substring)
        const { data: section, error: sectionError } = await supabase
            .from('report_sections')
            .select('id, section_id, heading, content')
            .eq('id', sectionRowId)
            .eq('report_id', reportId)
            .single();

        if (sectionError || !section) {
            return NextResponse.json(
                { error: "Section not found" },
                { status: 404 }
            );
        }

        // Extract the section's substring from tiptap_content (original text for the edit).
        // Try content match with several variants, then extract by heading.
        const sectionContent = section.content ?? '';
        const originalText =
            findSectionSubstring(fullReportText, sectionContent) ??
            extractSectionByHeading(fullReportText, section.heading ?? '');

        if (!originalText || !originalText.trim()) {
            return NextResponse.json(
                { error: "Section content not found in report. Report and sections may be out of sync." },
                { status: 400 }
            );
        }

        // Build the prompt for the LLM (use section from report_sections for context)
        const systemPrompt = `You are an expert editor helping improve engineering reports. 
Your task is to edit the given section based on the user's instruction.
Keep the same professional tone and technical accuracy.
Return ONLY the edited text, nothing else - no explanations, no markdown code blocks, just the improved content.`;

        const userPrompt = `## Original Section: "${section.heading}"

${originalText}

## Instruction
${instruction}

## Your Task
Rewrite the section above following the instruction. Return only the edited text.`;

        console.log(`🤖 [AI Edit] Processing edit for section "${section.heading}" with instruction: "${instruction}"`);

        // Use generateText (non-streaming) to get the complete response
        const result = await generateText({
            model: ModelStrategy.getModel(provider as 'grok' | 'gemini-pro' | 'claude' | 'gemini-cheap'),
            system: systemPrompt,
            prompt: userPrompt,
        });

        const suggestedText = result.text.trim();

        if (!suggestedText) {
            return NextResponse.json(
                { error: "AI returned empty response" },
                { status: 500 }
            );
        }

        console.log(`✅ [AI Edit] Generated edit: ${suggestedText.length} chars (original: ${originalText.length} chars)`);

        // Return the edit suggestion (originalText is the substring from tiptap_content)
        return NextResponse.json({
            status: 'SUCCESS',
            suggestion: {
                sectionRowId: section.id,
                sectionId: section.section_id,
                sectionHeading: section.heading,
                originalText,
                suggestedText,
                reason: instruction,
                status: 'PENDING'
            }
        });

    } catch (error: any) {
        console.error("❌ [AI Edit] Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to generate edit" },
            { status: 500 }
        );
    }
}

/**
 * Try to find section content in full report text using several variants (exact, trimmed, normalized line endings).
 * Returns the exact substring that appears in fullText, or null.
 */
function findSectionSubstring(fullText: string, sectionContent: string): string | null {
    if (!sectionContent.trim()) return null;
    const variants = [
        sectionContent,
        sectionContent.trim(),
        sectionContent.replace(/\r\n/g, '\n'),
        sectionContent.replace(/\r\n/g, '\n').trim(),
    ];
    for (const v of variants) {
        if (v && fullText.includes(v)) return v;
    }
    return null;
}

/**
 * Extract a section from full report text by finding the heading line and taking
 * from there until the next markdown heading (## or #) or end of document.
 * Heading may be stored with or without leading # (e.g. "## Executive Summary" or "Executive Summary").
 * Returns a substring with normalized line endings (\n) so replace() in the service can match
 * (service normalizes tiptap_content before replace).
 */
function extractSectionByHeading(fullText: string, heading: string): string | null {
    const raw = (heading ?? '').trim();
    if (!raw) return null;
    const normalizedFull = fullText.replace(/\r\n/g, '\n');
    // Strip leading # so we match the text part in the document
    const headingText = raw.replace(/^#+\s*/, '').trim() || raw;
    const escaped = headingText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Match optional # prefix and the heading; allow \n or \r\n after
    const headingRegex = new RegExp(`(^|\\n)(#{0,6}\\s*)${escaped}\\s*(?:\\n|\\r\\n)?`, 'im');
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
