import { streamText, convertToModelMessages, stepCountIs } from 'ai';
import { ModelStrategy } from '../Models/model-strategy';
import { researchSkills } from '../skills/research.skills';
import { reportSkills } from '../skills/report.skills';

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
    }) {
        const { messages, provider, context, projectId, userId, systemMessage } = params;

        // Build tools - include report skills if we have context
        const tools: any = {
            ...researchSkills,
        };

        // If we have report context and IDs, add report editing skills
        if (context && projectId && userId) {
            Object.assign(tools, reportSkills(projectId, userId));
        }

        // Build system prompt - use custom systemMessage if provided, otherwise default
        const systemPrompt = systemMessage || `You are a helpful research assistant.
               1. ALWAYS search 'searchInternalKnowledge' first.
               2. If the answer is missing or low confidence, use 'searchWeb'.
               3. Answer strictly based on the tool outputs.
               ${context ? '4. You can edit report sections using "updateSection" when the user requests changes.' : ''}`;

        return streamText({
            model: ModelStrategy.getModel(provider),
            messages: await convertToModelMessages(messages),
            system: systemPrompt,
            stopWhen: stepCountIs(10),
            tools
        });
    }
}
