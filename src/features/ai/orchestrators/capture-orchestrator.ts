import { streamText, convertToModelMessages, stepCountIs } from 'ai';
import { ModelStrategy } from '../Models/model-strategy';
import { audioTools } from '../chatbot/tools/audio.tools';
import { buildSkillPrompt } from '../chatbot/skill-loader';
import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Audio Orchestrator using AI-SDK.
 * Has audio skills (audioSkills)
 */
export class CaptureOrchestrator {
    async generateStream(params: {
        messages: any[],
        provider: 'grok' | 'gemini-pro' | 'claude' | 'gemini-cheap',
        context?: any,
        projectId?: string,
        userId?: string,
        reportId?: string,
        systemMessage?: string;
        client: SupabaseClient;
        /** Called after the model finishes generating (reliable hook for persistence). */
        onFinish?: (event: { text: string; finishReason: string }) => void | Promise<void>;
    }) {
        const { messages, provider, context, projectId, userId, systemMessage, client, onFinish } = params;

        // Build tools - include report skills if we have context
        const tools: any = {
            ...audioTools,
        };


        // Build system prompt - use custom systemMessage if provided (e.g. selection-edit ack), otherwise default
        const systemPrompt = systemMessage || this.buildSystemPrompt();

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
     * Build the system prompt for audio analysis tasks.
     */
    private buildSystemPrompt(): string {
        return buildSkillPrompt(['audio-processing']);
    }
}
