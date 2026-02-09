import { streamText, generateText, stepCountIs } from 'ai';
import { ModelStrategy } from '../Models/model-strategy';
import { editSkills } from '../skills/edit.skills';

/**
 * Edit Orchestrator – selection-based editing only.
 *
 * Context (selection + surrounding) is always supplied by the caller (frontend).
 * This orchestrator never fetches report content from the DB; the only way edit
 * content is provided is via the request body from the client.
 *
 * When projectId is provided, the edit agent uses edit skills (research + future
 * edit-specific tools) to make fact-based edits; otherwise it edits without tools.
 */
export class EditOrchestrator {
    private static readonly SYSTEM_PROMPT_NO_TOOLS = `You are an expert editor helping improve engineering reports.
Your task is to edit the selected text based on the user's instruction.
Keep the same professional tone and technical accuracy.
Return ONLY the replacement text for the selection — no explanations, no markdown code blocks, no preamble.`;

    private static readonly SYSTEM_PROMPT_WITH_RESEARCH = `You are an expert editor helping improve engineering reports.
Your task is to edit the selected text based on the user's instruction. You may use your research tools (searchInternalKnowledge, searchWeb) when the instruction requires factual accuracy, up-to-date standards, or external context.
Keep the same professional tone and technical accuracy. After any research, return ONLY the replacement text for the selection — no explanations, no markdown code blocks, no preamble.`;

    /**
     * Run selection edit. When projectId is set, uses research tools and returns
     * final text; otherwise streams with no tools. Caller should use
     * EditService.streamSelectionEdit() which returns a Response in both cases.
     */
    async runSelectionEdit(params: {
        selection: string;
        surroundingContext?: string;
        instruction: string;
        provider?: 'grok' | 'gemini-pro' | 'claude' | 'gemini-cheap';
        projectId?: string;
    }): Promise<{ stream: ReturnType<typeof streamText> } | { text: string }> {
        const { selection, surroundingContext, instruction, provider = 'gemini-cheap', projectId } = params;

        const userPrompt = surroundingContext
            ? `## Selected text (edit this):
${selection}

## Surrounding context (for flavor only):
${surroundingContext}

## Instruction
${instruction}

## Your task
Return only the edited replacement for the selected text.`
            : `## Selected text (edit this):
${selection}

## Instruction
${instruction}

## Your task
Return only the edited replacement for the selected text.`;

        if (projectId?.trim()) {
            const tools = editSkills(projectId.trim());
            const result = await generateText({
                model: ModelStrategy.getModel(provider),
                system: EditOrchestrator.SYSTEM_PROMPT_WITH_RESEARCH,
                prompt: userPrompt,
                stopWhen: stepCountIs(5),
                tools,
            });
            const text = (result.text ?? '').trim();
            return { text: text || selection };
        }

        const stream = streamText({
            model: ModelStrategy.getModel(provider),
            system: EditOrchestrator.SYSTEM_PROMPT_NO_TOOLS,
            prompt: userPrompt,
        });
        return { stream };
    }
}
