import { streamText, convertToModelMessages, stepCountIs } from 'ai';
import { ModelStrategy } from '../Models/model-strategy';
import { audioSkills } from '../skills/audio.skills';
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
            ...audioSkills,
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
        return `You are an assistant for engineering site inspections and report writing.

YOUR ROLE: When the user provides audio file URLs, use your audio analysis tools to process them.
Provide clear transcriptions and/or summaries of key observations, safety notes, or findings.

AUDIO TOOLS:
- Use 'audioSKill1TODO' to analyze multiple audio files (batch).
- Use 'audioSKill2TODO' to analyze a single audio file in detail.

Structure your response based on what the user asks for (transcript, summary, bullet points, report section, etc.).`;
    }
}
