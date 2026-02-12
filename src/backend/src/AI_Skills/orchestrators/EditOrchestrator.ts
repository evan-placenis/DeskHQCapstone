import { streamText } from 'ai';
import { ModelStrategy } from '../Models/model-strategy';

/**
 * Edit Orchestrator – selection-based editing only.
 *
 * Streams the replacement text so the client can show the popup as soon as the first token arrives.
 * No tools: we run a single generation step so time-to-first-token is minimal (~1–3s instead of 5–10s
 * when the model would otherwise call research tools first). For "make it concise" / "tone down" etc.
 * this is ideal. If you need research-backed edits later, add a separate flow or optional tools.
 */
export class EditOrchestrator {
    private static readonly SYSTEM_PROMPT = `You are an expert AI Editor for engineering reports.
Your task is to rewrite the provided content based on the user's instruction.

Input format: Markdown text (the selected passage, which may include **bold**, _italic_, links, lists, etc.).
Output format: ONLY the rewritten Markdown text. Do not wrap in \`\`\`markdown blocks. Do not add conversational filler ("Here is the edit:", etc.).

IMPORTANT:
- Preserve formatting (bold, italics, links, lists) unless the user asks to remove or change it.
- If the user sends a Markdown list, return a Markdown list.
- Keep the same professional tone and technical accuracy.`;

    /**
     * Stream selection edit. No tools = model goes straight to generating, so first token arrives quickly.
     */
    async streamSelectionEdit(params: {
        selection: string;
        surroundingContext?: string;
        instruction: string;
        provider?: 'grok' | 'gemini-pro' | 'claude' | 'gemini-cheap';
        projectId: string;
    }) {
        const { selection, surroundingContext, instruction, provider = 'gemini-cheap' } = params;

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
            model: ModelStrategy.getModel(provider),
            system: EditOrchestrator.SYSTEM_PROMPT,
            prompt: userPrompt,
        });
    }
}
