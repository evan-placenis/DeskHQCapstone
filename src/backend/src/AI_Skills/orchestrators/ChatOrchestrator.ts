import { streamText, convertToModelMessages, stepCountIs } from 'ai';
import { ModelStrategy } from '../Models/model-strategy';
import { researchSkills } from '../skills/research.skills';
import { reportSkills } from '../skills/report.skills';
import { chatSkills } from '../skills/chat.skills';
import { visionSkills } from '../skills/vison.skills';
import { editSkills } from '../skills/edit.skills';
import { channel } from 'diagnostics_channel';
import { SupabaseClient } from '@supabase/supabase-js';

/**
 * 🆕 Chat Orchestrator using AI-SDK
 * 
 * This orchestrator handles chat conversations with access to:
 * - Knowledge base search (RAG)
 * - Web research
 * - Report editing with diff support (when report context is provided)
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
        systemMessage?: string
        client: SupabaseClient;
    }) {
        const { messages, provider, context, projectId, userId, reportId, selectionEdit, systemMessage, client } = params;

        // Build tools - include report skills if we have context
        const tools: any = {
            ...researchSkills(projectId ?? ''),
            ...chatSkills,
            ...visionSkills
        };

        // If we have report context and IDs, add report editing skills
        if (context && projectId && userId) {
            Object.assign(tools, reportSkills(projectId, userId, client));
        }

        // If we have a reportId and this is not a selection-edit turn, add the edit skills for diff-based editing
        if (reportId && !selectionEdit) {
            Object.assign(tools, editSkills(reportId, client));
        }

        // Build system prompt - use custom systemMessage if provided (e.g. selection-edit ack), otherwise default
        const systemPrompt = systemMessage || this.buildSystemPrompt(!!reportId && !selectionEdit);

        return streamText({
            model: ModelStrategy.getModel(provider),
            messages: await convertToModelMessages(messages),
            system: systemPrompt,
            stopWhen: stepCountIs(10),
            tools
        });
    }

    /**
     * Build the system prompt based on available context
     */
    private buildSystemPrompt(hasReportContext: boolean): string {
        let prompt = `You are a helpful assistant for engineering report writing and research.

RESEARCH TOOLS:
1. ALWAYS use 'searchInternalKnowledge' first for any factual questions.
2. If the answer is missing or low confidence, use 'searchWeb'.
3. Answer strictly based on the tool outputs.`;

        if (hasReportContext) {
            prompt += `

REPORT EDITING (section-by-name only):
- Use report editing tools ONLY when the user asks to edit a section BY NAME (e.g. "make the executive summary more concise") and has NOT selected any text in the report.
- If the user HAS selected/highlighted text, or says "this", "the selection", or "what I highlighted", do NOT call retrieveReportContext. Reply briefly that their edit will be applied to the selection (e.g. "I've suggested an edit to your selection. Review the changes in the popup.").
- When the user clearly refers to a section by name (and has not selected text):
  1. Call 'retrieveReportContext' with a query for that section name.
  2. If status is 'SUCCESS': Respond naturally with what you'll change; include the sectionRowId so the system can generate the edit. Example: "I'll make the Executive Summary more concise."
  3. If status is 'NO_MATCH': Tell the user which sections are available (availableSections) and ask them to clarify.
  4. If status is 'NOT_FOUND' or 'REPORT_EMPTY': Use the returned message to inform the user.
- Do NOT call proposeEdit; the edit is generated separately.`;
        }

        return prompt;
    }
}
