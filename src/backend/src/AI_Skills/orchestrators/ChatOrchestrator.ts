import { streamText, convertToModelMessages, stepCountIs } from 'ai';
import { ModelStrategy } from '../Models/model-strategy';
import { researchSkills } from '../skills/research.skills';
import { reportSkills } from '../skills/report.skills';
import { chatSkills } from '../skills/chat.skills';
import { visionSkills } from '../skills/vison.skills';
import { channel } from 'diagnostics_channel';
import { SupabaseClient } from '@supabase/supabase-js';

/**
 * 🆕 Chat Orchestrator using AI-SDK
 * 
 * This orchestrator handles chat conversations with access to:
 * - Knowledge base search (RAG)
 * - Web research
 * - Report editing (when report context is provided)
 */
export class ChatOrchestrator {
    async generateStream(params: {
        messages: any[],
        provider: 'grok' | 'gemini' | 'claude',
        context?: any,
        projectId?: string,
        userId?: string,
        systemMessage?: string
        client: SupabaseClient;
    }) {
        const { messages, provider, context, projectId, userId, systemMessage, client } = params;

        // Build tools - include report skills if we have context
        const tools: any = {
            ...researchSkills,
            ...chatSkills,
            ...visionSkills
        };

        // If we have report context and IDs, add report editing skills
        if (context && projectId && userId) {
            Object.assign(tools, reportSkills(projectId, userId, client));
        }

        // Build system prompt - use custom systemMessage if provided, otherwise default
        const systemPrompt = systemMessage || `You are a helpful research assistant.
               1. ALWAYS search 'searchInternalKnowledge' first.
               2. If the answer is missing or low confidence, use 'searchWeb'.
               3. Answer strictly based on the tool outputs.
               ${context ? '4. You can edit report sections using "updateSection" when the user requests changes in the report they are editing..' : ''}`;

        return streamText({
            model: ModelStrategy.getModel(provider),
            messages: await convertToModelMessages(messages),
            system: systemPrompt,
            stopWhen: stepCountIs(10),
            tools
        });
    }
}
