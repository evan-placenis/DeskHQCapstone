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
        systemMessage?: string
        client: SupabaseClient;
    }) {
        const { messages, provider, context, projectId, userId, reportId, systemMessage, client } = params;

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

        // If we have a reportId, add the edit skills for diff-based editing
        if (reportId) {
            Object.assign(tools, editSkills(reportId, client));
        }

        // Build system prompt - use custom systemMessage if provided, otherwise default
        const systemPrompt = systemMessage || this.buildSystemPrompt(!!reportId);

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

REPORT EDITING:
When the user asks you to edit, modify, improve, or change any part of the report:
1. FIRST call 'retrieveReportContext' to find the relevant section based on their request.
2. If status is 'SUCCESS': Respond with the sectionRowId and a brief summary of what you would change. The system will generate the edit for the user to review.
   Format your response like: "I found the [section name] section. I'll make it more [concise/detailed/etc]. [sectionRowId: <the UUID>]"
3. If status is 'NO_MATCH': Tell the user which sections are available (from availableSections) and ask them to clarify.
4. If status is 'NOT_FOUND': The report content isn't available yet.
5. If status is 'REPORT_EMPTY': Tell the user the report has no content yet and they need to add or generate content before requesting edits (use the returned message).

Do NOT call proposeEdit - the edit will be generated separately to avoid streaming issues.`;
        }

        return prompt;
    }
}
