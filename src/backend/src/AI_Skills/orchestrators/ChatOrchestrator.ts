import { streamText, convertToModelMessages, stepCountIs } from 'ai';
import { ModelStrategy } from '../Models/model-strategy';
import { researchSkills } from '../skills/research.skills';
import { reportSkills } from '../skills/report.skills';
import { chatSkills } from '../skills/chat.skills';
import { visionSkills } from '../skills/vison.skills';
import { SupabaseClient } from '@supabase/supabase-js';

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
    }) {
        const { messages, provider, context, projectId, userId, reportId, selectionEdit, systemMessage, client, onFinish, documentOutline, activeSectionMarkdown, activeSectionHeading, fullReportMarkdown } = params;

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
            model: ModelStrategy.getModel(provider),
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
1. For questions about the report content: call read_full_report (or read_specific_sections if you see section names in the outline above). Answer from that.
2. ONLY use searchInternalKnowledge or searchWeb when the user explicitly asks for external information (e.g. "what does OSHA say about...", "industry best practices for...").

Respond concisely. Do not explain your reasoning.`;
        }

        return `You are a helpful assistant for engineering report writing and research.

YOUR ROLE: When the user asks a question (about the report or anything else), respond in the chat. Use your research tools when you need to look something up to answer accurately.

RESEARCH TOOLS (use when the user's question needs facts, standards, or external context):
1. Use 'searchInternalKnowledge' first for project-specific or internal information.
2. If the answer is missing or you need current/external info, use 'searchWeb'.
3. Base your answer on the tool outputs; cite or summarize what you found.`;
    }
}
