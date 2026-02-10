import { SupabaseClient } from '@supabase/supabase-js';
import { EditOrchestrator } from '../AI_Skills/orchestrators/EditOrchestrator';

const VALID_PROVIDERS = ['grok', 'gemini-pro', 'claude', 'gemini-cheap'] as const;
type Provider = (typeof VALID_PROVIDERS)[number];

function normalizeProvider(provider: unknown): Provider {
    return VALID_PROVIDERS.includes(provider as Provider) ? (provider as Provider) : 'gemini-cheap';
}

export class ReportNotFoundError extends Error {
    name = 'ReportNotFoundError';
}

/**
 * Edit Service – selection-based report editing.
 *
 * Resolves projectId from the report, runs the edit orchestrator (with tools), returns a Response.
 */
export class EditService {
    constructor(private readonly editOrchestrator: EditOrchestrator) {}

    /**
     * Run selection edit: resolve project_id, stream tokens from the model as they are generated.
     * @throws ReportNotFoundError if report does not exist or has no project_id
     */
    async streamSelectionEdit(
        reportId: string,
        params: {
            selection: string;
            surroundingContext?: string;
            instruction: string;
            provider?: string;
        },
        client: SupabaseClient
    ): Promise<Response> {
        const { data: report, error: reportError } = await client
            .from('reports')
            .select('project_id')
            .eq('id', reportId)
            .single();

        if (reportError || !report?.project_id) {
            throw new ReportNotFoundError('Report not found');
        }

        const provider = normalizeProvider(params.provider);
        const result = await this.editOrchestrator.streamSelectionEdit({
            selection: params.selection,
            surroundingContext:
                typeof params.surroundingContext === 'string' ? params.surroundingContext : undefined,
            instruction: params.instruction,
            provider,
            projectId: String(report.project_id),
        });

        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            async start(controller) {
                try {
                    for await (const chunk of result.textStream) {
                        controller.enqueue(encoder.encode(chunk));
                    }
                } catch (err) {
                    controller.error(err);
                } finally {
                    controller.close();
                }
            },
        });
        return new Response(stream, {
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Cache-Control': 'no-cache',
                'X-Content-Type-Options': 'nosniff',
            },
        });
    }
}
