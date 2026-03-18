import { streamText, convertToModelMessages, stepCountIs } from 'ai';
import { ModelStrategy } from '../Models/model-strategy';
import { researchTools } from '../chatbot-skills/tools/research.tools';
import { reportTools } from '../chatbot-skills/tools/report.tools';
import { chatContextTools } from '../chatbot-skills/tools/chat-context.tools';
import { visionTools } from '../chatbot-skills/tools/vision.tools';
import { buildSkillPrompt } from '../chatbot-skills/agent-skills/skill-loader';
import { SupabaseClient } from '@supabase/supabase-js';
import type { HeliconeContextInput } from '../gateway/HeliconeContextBuilder';

/**
 * Chat Orchestrator using AI-SDK.
 *
 * Has research tools (searchInternalKnowledge, searchWeb), report tools (when context
 * is provided), chat and vision tools. It does NOT have any tool that retrieves report
 * content from the DB for editing; edit content is provided only by the frontend (selection flow).
 */
export class ChatOrchestrator {
    async generateStream(params: {
        messages: any[],
        provider: 'grok' | 'gemini-pro' | 'claude' | 'gemini-cheap',
        context?: any,
        projectId?: string,
        userId?: string,
        reportId?: string,
        /** When true, user edited via selection (client-side); do not add edit skills so assistant does not call retrieveReportContext */
        selectionEdit?: boolean,
        systemMessage?: string;
        client: SupabaseClient;
        /** Called after the model finishes generating (reliable hook for persistence). */
        onFinish?: (event: { text: string; finishReason: string }) => void | Promise<void>;
        /** Map: document outline from the live editor */
        documentOutline?: string;
        /** Lens: active section markdown from the live editor */
        activeSectionMarkdown?: string;
        /** Lens: heading of the active section */
        activeSectionHeading?: string;
        /** Full report markdown from the live editor (for server-side document tools) */
        fullReportMarkdown?: string;
        heliconeInput?: HeliconeContextInput;
    }) {
        const { messages, provider, context, projectId, userId, reportId, selectionEdit, systemMessage, client, onFinish, documentOutline, activeSectionMarkdown, activeSectionHeading, fullReportMarkdown, heliconeInput } = params;

        // [ChatContext] Debug: log context available to orchestrator
        const hasDocumentTools = !!(fullReportMarkdown?.trim());
        const hasMapLens = !!(documentOutline?.trim());
        console.log('[ChatContext] ChatOrchestrator.generateStream:', {
            hasDocumentTools,
            fullReportMarkdownLen: fullReportMarkdown?.length ?? 0,
            hasMapLens,
            documentOutlineLen: documentOutline?.length ?? 0,
            activeSectionHeading: activeSectionHeading ?? '(none)',
            activeSectionMarkdownLen: activeSectionMarkdown?.length ?? 0,
            promptVariant: hasDocumentTools ? 'report-aware' : 'default',
        });

        // Build tools - include report skills if we have context
        const tools: any = {
            ...researchTools(projectId ?? ''),
            ...chatContextTools(fullReportMarkdown),
            ...visionTools
        };

        // If we have report context and IDs, add report editing skills
        if (context && projectId && userId) {
            Object.assign(tools, reportTools(projectId, userId, client));
        }

        // Edit flow is selection-only and handled by EditOrchestrator via ai-edit route; Chat has no edit tools.

        // Build system prompt - use custom systemMessage if provided (e.g. selection-edit ack), otherwise default
        const systemPrompt = systemMessage || this.buildSystemPrompt(documentOutline, activeSectionMarkdown, activeSectionHeading, fullReportMarkdown);

        const registeredToolNames = Object.keys(tools);
        const skillNames = !systemMessage
            ? (hasDocumentTools
                ? ['chat-core', 'research', 'vision', 'report-aware-chat']
                : ['chat-core', 'research', 'vision'])
            : ['(overridden by systemMessage)'];
        console.log(`[Chat] Skills injected into system prompt: [${skillNames.join(', ')}] (${systemPrompt.length} chars)`);
        console.log(`[Chat] Tools registered: [${registeredToolNames.join(', ')}]`);

        return streamText({
            model: ModelStrategy.getModel(provider, heliconeInput),
            messages: await convertToModelMessages(messages),
            system: systemPrompt,
            stopWhen: stepCountIs(10),
            tools,
            onFinish,

            experimental_onToolCallStart({ toolCall }: { toolCall: { toolName: string; toolCallId: string } }) {
                console.log(`[Chat] Tool call started: ${toolCall.toolName} (${toolCall.toolCallId})`);
            },

            experimental_onToolCallFinish({ toolCall, durationMs, success }: { toolCall: { toolName: string; toolCallId: string }; durationMs: number; success: boolean }) {
                const status = success ? 'OK' : 'FAILED';
                console.log(`[Chat] Tool call finished: ${toolCall.toolName} [${status}] (${durationMs}ms)`);
            },

            onStepFinish({ finishReason }: { finishReason: string }) {
                console.log(`[Chat] Step finished — reason: ${finishReason}`);
            },
        } as any);
    }

    /**
     * Build the system prompt with Map & Lens context when available.
     * Loads Skill markdown instructions and appends runtime report context.
     */
    private buildSystemPrompt(
        documentOutline?: string,
        activeSectionMarkdown?: string,
        activeSectionHeading?: string,
        fullReportMarkdown?: string,
    ): string {
        const hasDocumentTools = !!(fullReportMarkdown?.trim());
        const hasMapLens = !!(documentOutline?.trim());
        const baseSkillPrompt = buildSkillPrompt(['chat-core', 'research', 'vision']);

        if (hasDocumentTools) {
            const reportSkillPrompt = buildSkillPrompt(['report-aware-chat']);
            const outlineBlock = hasMapLens
                ? `DOCUMENT OUTLINE (Table of Contents):\n${documentOutline}\n\n`
                : '';
            const activeSectionBlock = activeSectionHeading
                ? `THE USER IS CURRENTLY LOOKING AT THIS SECTION: "${activeSectionHeading}"
--- Active Section Content ---
${activeSectionMarkdown || '(empty section)'}
--- End Active Section ---\n\n`
                : '';

            return `${baseSkillPrompt}

${reportSkillPrompt}

${outlineBlock}${activeSectionBlock}`.trim();
        }

        return baseSkillPrompt;
    }
}
