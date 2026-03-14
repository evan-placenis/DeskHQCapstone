import { streamText, convertToModelMessages, stepCountIs } from 'ai';
import { ModelStrategy } from '../Models/model-strategy';
import { researchSkills } from '../skills/research.skills';
import { reportSkills } from '../skills/report.skills';
import { chatSkills } from '../skills/chat.skills';
import { visionSkills } from '../skills/vison.skills';
import { SupabaseClient } from '@supabase/supabase-js';
import type { HeliconeContextInput } from '../gateway/HeliconeContextBuilder';

/**
 * Chat Orchestrator using AI-SDK.
 *
 * Has research tools (searchInternalKnowledge, searchWeb), report tools (when context
 * is provided), chat and vision tools. It does NOT have any tool that retrieves report
 * content from the DB for editing; edit content is provided only by the frontend (selection flow).
 */
export class ChatOrchestrator {
    async generateStream(params: {
        messages: any[],
        provider: 'grok' | 'gemini-pro' | 'claude' | 'gemini-cheap',
        context?: any,
        projectId?: string,
        userId?: string,
        reportId?: string,
        /** When true, user edited via selection (client-side); do not add edit skills so assistant does not call retrieveReportContext */
        selectionEdit?: boolean,
        systemMessage?: string;
        client: SupabaseClient;
        /** Called after the model finishes generating (reliable hook for persistence). */
        onFinish?: (event: { text: string; finishReason: string }) => void | Promise<void>;
        /** Map: document outline from the live editor */
        documentOutline?: string;
        /** Lens: active section markdown from the live editor */
        activeSectionMarkdown?: string;
        /** Lens: heading of the active section */
        activeSectionHeading?: string;
        /** Full report markdown from the live editor (for server-side document tools) */
        fullReportMarkdown?: string;
        heliconeInput?: HeliconeContextInput;
    }) {
        const { messages, provider, context, projectId, userId, reportId, selectionEdit, systemMessage, client, onFinish, documentOutline, activeSectionMarkdown, activeSectionHeading, fullReportMarkdown, heliconeInput } = params;

        // [ChatContext] Debug: log context available to orchestrator
        const hasDocumentTools = !!(fullReportMarkdown?.trim());
        const hasMapLens = !!(documentOutline?.trim());
        console.log('[ChatContext] ChatOrchestrator.generateStream:', {
            hasDocumentTools,
            fullReportMarkdownLen: fullReportMarkdown?.length ?? 0,
            hasMapLens,
            documentOutlineLen: documentOutline?.length ?? 0,
            activeSectionHeading: activeSectionHeading ?? '(none)',
            activeSectionMarkdownLen: activeSectionMarkdown?.length ?? 0,
            promptVariant: hasDocumentTools ? 'report-aware' : 'default',
        });

        // Build tools - include report skills if we have context
        const tools: any = {
            ...researchSkills(projectId ?? ''),
            ...chatSkills(fullReportMarkdown),
            ...visionSkills
        };

        // If we have report context and IDs, add report editing skills
        if (context && projectId && userId) {
            Object.assign(tools, reportSkills(projectId, userId, client));
        }

        // Edit flow is selection-only and handled by EditOrchestrator via ai-edit route; Chat has no edit tools.

        // Build system prompt - use custom systemMessage if provided (e.g. selection-edit ack), otherwise default
        const systemPrompt = systemMessage || this.buildSystemPrompt(false, documentOutline, activeSectionMarkdown, activeSectionHeading, fullReportMarkdown);

        return streamText({
            model: ModelStrategy.getModel(provider, heliconeInput),
            messages: await convertToModelMessages(messages),
            system: systemPrompt,
            stopWhen: stepCountIs(10),
            tools,
            onFinish,
        });
    }

    /**
     * Build the system prompt with Map & Lens context when available.
     * Use report-aware prompt whenever document tools exist (fullReportMarkdown) — even if outline is empty.
     */
    private buildSystemPrompt(
        _hasReportContext: boolean,
        documentOutline?: string,
        activeSectionMarkdown?: string,
        activeSectionHeading?: string,
        fullReportMarkdown?: string,
    ): string {
        const hasDocumentTools = !!(fullReportMarkdown?.trim());
        const hasMapLens = !!(documentOutline?.trim());

        if (hasDocumentTools) {
            const outlineBlock = hasMapLens
                ? `DOCUMENT OUTLINE (Table of Contents):\n${documentOutline}\n\n`
                : '';
            const activeSectionBlock = activeSectionHeading
                ? `THE USER IS CURRENTLY LOOKING AT THIS SECTION: "${activeSectionHeading}"
--- Active Section Content ---
${activeSectionMarkdown || '(empty section)'}
--- End Active Section ---\n\n`
                : '';

            return `You are an expert report editor. The user is actively editing a report.

CRITICAL RULE: When the user refers to "this report", "the report", "the document", or asks about ANY content that could be in the report (e.g. "metal stairs", "executive summary", "what does it say about X"), you MUST use read_full_report or read_specific_sections FIRST. NEVER use searchInternalKnowledge or searchWeb for report content. Research tools are ONLY for external facts (standards, regulations, best practices) that would NOT be in the report.

${outlineBlock}${activeSectionBlock}HOW TO ANSWER (follow strictly):
1. For "summarize the report", "overview of the report", "entire report" — ALWAYS call read_full_report first. Do not rely on the Active Section alone; it is only the section where the cursor is. Give equal weight to all sections in your summary.
2. For questions about specific sections: call read_specific_sections with the heading names from the outline above.
3. For other report content questions: call read_full_report (or read_specific_sections if you know the section).
4. ONLY use searchInternalKnowledge or searchWeb when the user explicitly asks for external information (e.g. "what does OSHA say about...", "industry best practices for...").

STRUCTURE-BASED WRITING/EDITING (when user asks to WRITE something or EDIT something without selecting text):
5. When the user asks to write content (e.g. "write a conclusion", "add an executive summary", "write an intro", "can you add a recommendations section") — FIRST call read_full_report to understand the report, then call propose_structure_insertion with:
   - insertLocation: "start_of_report" for introductions, overviews, or any content that belongs at the beginning. "end_of_report" for conclusions, summaries, appendices, or content at the end. "after_heading" only when inserting between existing sections.
   - targetHeading: When insertLocation is "after_heading", provide the exact heading name from the report outline. Otherwise omit.
   - content: Full markdown including the heading (e.g. ## Conclusion) and body. Match heading levels to neighboring sections.
6. When the user asks to edit content (e.g. "edit the conclusion", "make the conclusion more concise", "rewrite the intro") — FIRST call read_specific_sections to get the current section content, then call propose_structure_insertion with:
   - insertLocation: "replace_section" (this REPLACES the section; do NOT use "after_heading" which would add a duplicate).
   - targetHeading: The exact heading name of the section to replace (e.g. "Conclusion").
   - content: Full markdown including the heading (e.g. # Conclusion) and the revised body. Match heading levels to neighboring sections.
7. Section scope: A section spans from its heading to the next heading of the same or higher level. "Rewrite the Building Inspection Report" (a # heading) replaces that heading and all its subsections until the next #. "Rewrite the Executive Summary" (a ## heading) replaces only that section, not Site Observations or following sections, etc. for lower level headings.
8. The user's cursor position does NOT matter — infer the correct location from report structure and conventions.

Respond concisely.`;
        }

        return `You are a helpful assistant for engineering report writing and research.

YOUR ROLE: When the user asks a question (about the report or anything else), respond in the chat. Use your research tools when you need to look something up to answer accurately.

RESEARCH TOOLS (use when the user's question needs facts, standards, or external context):
1. Use 'searchInternalKnowledge' first for project-specific or internal information.
2. If the answer is missing or you need current/external info, use 'searchWeb'.
3. Base your answer on the tool outputs; cite or summarize what you found.`;
    }
}
