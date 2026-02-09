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

        // Edit flow is selection-only and handled by EditOrchestrator via ai-edit route; Chat has no edit tools.

        // Build system prompt - use custom systemMessage if provided (e.g. selection-edit ack), otherwise default
        const systemPrompt = systemMessage || this.buildSystemPrompt(false);

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
    private buildSystemPrompt(_hasReportContext: boolean): string {
        return `You are a helpful assistant for engineering report writing and research.

RESEARCH TOOLS:
1. ALWAYS use 'searchInternalKnowledge' first for any factual questions.
2. If the answer is missing or low confidence, use 'searchWeb'.
3. Answer strictly based on the tool outputs.`;
    }
}
