import { generateText, stepCountIs } from 'ai';
import { ModelStrategy } from '../Models/model-strategy';
import { editSkills } from '../skills/edit.skills';

/**
 * Edit Orchestrator – selection-based editing only.
 *
 * Context (selection + surrounding) is always supplied by the caller (frontend).
 * This orchestrator never fetches report content from the DB; the only way edit
 * content is provided is via the request body from the client.
 *
 * Always runs with edit skills (research + future edit-specific tools) so the
 * agent can research when needed. projectId is required so those tools can
 * target the correct project (e.g. knowledge search); the route resolves it from
 * the report.
 */
export class EditOrchestrator {
    private static readonly SYSTEM_PROMPT = `You are an expert AI Editor for engineering reports.
Your task is to rewrite the provided content based on the user's instruction.

Input format: Markdown text (the selected passage, which may include **bold**, _italic_, links, lists, etc.).
Output format: ONLY the rewritten Markdown text. Do not wrap in \`\`\`markdown blocks. Do not add conversational filler ("Here is the edit:", etc.).

IMPORTANT:
- Preserve formatting (bold, italics, links, lists) unless the user asks to remove or change it.
- If the user sends a Markdown list, return a Markdown list.
- Keep the same professional tone and technical accuracy.
You may use research tools (searchInternalKnowledge, searchWeb) when the instruction requires factual accuracy or external context. After any research, return only the replacement Markdown.`;

    /**
     * Run selection edit with tools. Caller (EditService) resolves projectId from the report.
     */
    async runSelectionEdit(params: {
        selection: string;
        surroundingContext?: string;
        instruction: string;
        provider?: 'grok' | 'gemini-pro' | 'claude' | 'gemini-cheap';
        projectId: string;
    }): Promise<{ text: string }> {
        const { selection, surroundingContext, instruction, provider = 'gemini-cheap', projectId } = params;

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

        const tools = editSkills(projectId.trim());
        const result = await generateText({
            model: ModelStrategy.getModel(provider),
            system: EditOrchestrator.SYSTEM_PROMPT,
            prompt: userPrompt,
            stopWhen: stepCountIs(5),
            tools,
        });
        const text = (result.text ?? '').trim();
        return { text: text || selection };
    }
}
