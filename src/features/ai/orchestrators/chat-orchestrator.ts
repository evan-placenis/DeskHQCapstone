import { streamText, convertToModelMessages, stepCountIs } from 'ai';
import { ModelStrategy } from '@/features/ai/services/models/model-strategy';
import { researchTools } from '@/features/ai/tools/chatbot-research-tools';
import { reportTools } from '@/features/ai/tools/chatbot-report-tools';
import { chatContextTools } from '@/features/ai/tools/chatbot-chat-context-tools';
import { visionTools } from '@/features/ai/tools/chatbot-vision-tools';
import { buildSkillPrompt } from '@/features/ai/services/chatbot/skill-loader';
import { SupabaseClient } from '@supabase/supabase-js';
import type { HeliconeContextInput } from '@/src/features/ai/services/models/gateway/helicone-context-builder';
import type { AiSdkChatProvider } from "@/lib/ai-providers";
import { logger } from "@/lib/logger";

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
        provider: AiSdkChatProvider,
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
        logger.info('[ChatContext] ChatOrchestrator.generateStream:', {
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
                ? ['core-conversation', 'knowledge-search', 'image-schematic-analysis', 'report-context-chat']
                : ['core-conversation', 'knowledge-search', 'image-schematic-analysis'])
            : ['(overridden by systemMessage)'];
        logger.info(`[Chat] Skills injected into system prompt: [${skillNames.join(', ')}] (${systemPrompt.length} chars)`);
        logger.info(`[Chat] Tools registered: [${registeredToolNames.join(', ')}]`);

        // When the user sent a selection-based edit, the actual rewrite is handled
        // by the /api/report/[id]/ai-edit route on the client.  Force toolChoice
        // to 'none' so the AI SDK blocks any tool calls in this chat turn — without
        // this guard the model sometimes calls propose_structure_insertion, which
        // causes a second applyInlineDiff on already-marked content and corrupts
        // the diff state (double-blink + broken reject).
        const toolChoiceOption = selectionEdit ? ({ toolChoice: 'none' } as const) : {};

        return streamText({
            model: ModelStrategy.getModel(provider, heliconeInput),
            messages: await convertToModelMessages(messages),
            system: systemPrompt,
            stopWhen: stepCountIs(10),
            tools,
            ...toolChoiceOption,
            onFinish,

            experimental_onToolCallStart({ toolCall }: { toolCall: { toolName: string; toolCallId: string } }) {
                logger.info(`[Chat] Tool call started: ${toolCall.toolName} (${toolCall.toolCallId})`);
            },

            experimental_onToolCallFinish({ toolCall, durationMs, success }: { toolCall: { toolName: string; toolCallId: string }; durationMs: number; success: boolean }) {
                const status = success ? 'OK' : 'FAILED';
                logger.info(`[Chat] Tool call finished: ${toolCall.toolName} [${status}] (${durationMs}ms)`);
            },

            onStepFinish({ finishReason }: { finishReason: string }) {
                logger.info(`[Chat] Step finished — reason: ${finishReason}`);
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
        const baseSkillPrompt = buildSkillPrompt(['core-conversation', 'knowledge-search', 'image-schematic-analysis']);

        if (hasDocumentTools) {
            const reportSkillPrompt = buildSkillPrompt(['report-context-chat']);
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
