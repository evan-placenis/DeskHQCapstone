import { streamText } from 'ai';
import { ModelStrategy } from '@/features/ai/services/models/model-strategy';
import { buildSkillPrompt } from '@/features/ai/services/chatbot/skill-loader';
import type { HeliconeContextInput } from '@/features/ai/services/gateway/helicone-context-builder';

/**
 * Edit Orchestrator – selection-based editing only.
 *
 * Streams the replacement text so the client can show the popup as soon as the first token arrives.
 * No tools: we run a single generation step so time-to-first-token is minimal (~1–3s instead of 5–10s
 * when the model would otherwise call research tools first). For "make it concise" / "tone down" etc.
 * this is ideal. If you need research-backed edits later, add a separate flow or optional tools.
 */
export class EditOrchestrator {

    /**
     * Stream selection edit. No tools = model goes straight to generating, so first token arrives quickly.
     */
    async streamSelectionEdit(params: {
        selection: string;
        surroundingContext?: string;
        instruction: string;
        provider?: 'grok' | 'gemini-pro' | 'claude' | 'gemini-cheap';
        projectId: string;
        heliconeInput?: HeliconeContextInput;
    }) {
        const { selection, surroundingContext, instruction, provider = 'gemini-cheap', heliconeInput } = params;

        const userPrompt = surroundingContext
            ? `## Selected Markdown (edit this):
${selection}

## Surrounding context (for flavor only):
${surroundingContext}

## Instruction
${instruction}

Return only the edited replacement Markdown (no code fence, no preamble).`
            : `## Selected Markdown (edit this):
${selection}

## Instruction
${instruction}

Return only the edited replacement Markdown (no code fence, no preamble).`;

        return streamText({
            model: ModelStrategy.getModel(provider, heliconeInput),
            system: buildSkillPrompt(['inline-selection-edit']),
            prompt: userPrompt,
        });
    }
}
