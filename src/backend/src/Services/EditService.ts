import { EditOrchestrator } from '../AI_Skills/orchestrators/EditOrchestrator';

/**
 * Edit Service – selection-based report editing.
 *
 * No report content is read from the DB; context (selection + surrounding) is
 * provided only by the client. When projectId is sent, the edit agent can use
 * research tools to make fact-based edits; otherwise it edits without tools.
 * Returns a Response so the route stays thin.
 */
export class EditService {
    constructor(private readonly editOrchestrator: EditOrchestrator) {}

    /**
     * Run selection edit and return a Response (stream of replacement text).
     * With projectId: runs with research tools then streams the final text;
     * without: streams the model output directly with no tools.
     */
    async streamSelectionEdit(params: {
        selection: string;
        surroundingContext?: string;
        instruction: string;
        provider?: 'grok' | 'gemini-pro' | 'claude' | 'gemini-cheap';
        projectId?: string;
    }): Promise<Response> {
        const result = await this.editOrchestrator.runSelectionEdit(params);

        if ('stream' in result) {
            return result.stream.toTextStreamResponse();
        }

        const text = result.text ?? '';
        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue(new TextEncoder().encode(text));
                controller.close();
            },
        });
        return new Response(stream, {
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
    }
}
