import { ChatRepository } from "../domain/interfaces/ChatRepository";
import { ChatOrchestrator } from "../AI_Skills/orchestrators/ChatOrchestrator";
import { ChatSession, ChatMessage } from "../domain/chat/chat.types";
import { v4 as uuidv4 } from 'uuid';
import { ReportService } from "./ReportService";
import { SupabaseClient } from "@supabase/supabase-js";

/**
 * 🆕 NEW ChatService using AI-SDK with Skills
 * 
 * This version uses the AI-SDK ChatOrchestrator which leverages:
 * - streamText from 'ai' package
 * - Skills-based tools (knowledgeSkills, researchSkills)
 * - ModelStrategy for provider selection
 * 
 * Key differences from old version:
 * - Uses AI-SDK streamText instead of custom agent chain
 * - Handles streaming responses
 * - Integrates with reportSkills when report context is available
 */
export class ChatService {

    // Dependencies
    private repo: ChatRepository;
    private chatOrchestrator: ChatOrchestrator;
    private reportService: ReportService;

    constructor(repo: ChatRepository, reportService: ReportService, chatOrchestrator: ChatOrchestrator) {
        this.repo = repo;
        this.chatOrchestrator = chatOrchestrator;
        this.reportService = reportService;
    }

    /**
     * The Main Function: Handles the full loop using AI-SDK
     * 
     * This method:
     * 1. Saves user message
     * 2. Fetches report context if available
     * 3. Calls AI-SDK orchestrator with skills
     * 4. Processes streaming response
     * 5. Saves AI message
     */
    public async handleUserMessage(
        sessionId: string,
        userText: string,
        client: SupabaseClient,
        activeSectionId?: string,
        reportId?: string,
        provider: 'grok' | 'gemini-pro' | 'gemini-cheap' | 'claude' = 'gemini-cheap'
    ): Promise<ChatMessage> {

        // 1. Fetch Session and Save USER Message
        const session = await this.repo.getSessionById(sessionId, client);
        if (!session) throw new Error("Session not found");

        const userMsg: ChatMessage = {
            messageId: uuidv4(),
            sessionId: sessionId,
            sender: 'user',
            content: userText,
            timestamp: new Date()
        };
        await this.repo.addMessage(sessionId, userMsg, client);
        await this.repo.updateSessionTimestamp(sessionId, new Date(), client);

        // 2. 🔍 FETCH HYBRID CONTEXT
        let reportContext: any = null;
        const targetReportId = session.reportId || reportId;

        if (targetReportId && activeSectionId) {
            try {
                reportContext = await this.reportService.getSectionContextForAI(
                    targetReportId,
                    activeSectionId,
                    client
                );
            } catch (error) {
                console.error(`⚠️ Failed to fetch section context:`, error);
            }
        }

        // 3. Build System Message
        let systemMessage: string | undefined = undefined;
        if (reportContext) {
            const contextText = this.sectionToText(reportContext);
            systemMessage = `You are helping edit a report section titled "${reportContext.heading}". 
            Current content:\n\n${contextText}\n\n
            If the user asks for changes, use the 'updateSection' tool to suggest the new Markdown.`;
        }

        // 4. Call Orchestrator
        const streamResult = await this.chatOrchestrator.generateStream({
            messages: session.messages.slice(-10).map(m => ({
                role: m.sender,
                content: m.content
            })).concat([{ role: 'user', content: userText }]),
            provider,
            projectId: session.projectId,
            userId: session.userId,
            systemMessage,
            client
        });

        /// 5. Process Stream
        let fullText = '';
        for await (const chunk of streamResult.textStream) {
            fullText += chunk;
        }

        // 6. Check for Suggestions (Tool Calls)
        const result = await streamResult;
        let suggestion: any = undefined;


        if (result.toolCalls && activeSectionId) {
            const toolCalls = await result.toolCalls;

            const updateCall = toolCalls.find((c: any) => c.toolName === 'updateSection') as any;
            if (updateCall && updateCall.args) {
                suggestion = {
                    targetSectionId: activeSectionId,
                    originalText: this.sectionToText(reportContext),
                    suggestedText: updateCall.args.content, // Use content from hybrid schema
                    reason: "AI suggested edit",
                    status: 'PENDING'
                };
            }
        }

        // 7. Save assistant message
        const aiMsg: ChatMessage = {
            messageId: uuidv4(),
            sessionId: sessionId,
            sender: 'assistant',
            content: fullText,
            suggestion,
            timestamp: new Date()
        };
        await this.repo.addMessage(sessionId, aiMsg, client);
        return aiMsg;
    }

    /**
     * ✅ UPDATED: Apply AI suggestion to the Hybrid database
     */
    public async acceptSuggestion(sessionId: string, messageId: string, client: SupabaseClient): Promise<void> {
        const session = await this.repo.getSessionById(sessionId, client);
        if (!session?.reportId) throw new Error("Context missing");

        const message = session.messages.find(m => m.messageId === messageId);
        if (!message?.suggestion) throw new Error("No suggestion found");

        // 1. Fetch current section to preserve 'order' and 'metadata'
        const existing = await this.reportService.getSectionContextForAI(
            session.reportId,
            message.suggestion.targetSectionId,
            client
        );

        // 2. Apply the update using the new 7-argument signature
        await this.reportService.updateSectionInReport(
            session.reportId,                 // 1. reportId
            message.suggestion.targetSectionId, // 2. sectionId
            existing.heading,                 // 3. heading (preserve original)
            message.suggestion.suggestedText,  // 4. content (the AI fix)
            existing.order || 0,              // 5. order
            client,                           // 6. client
            existing.metadata || {}           // 7. metadata (preserve severity/status)
        );

        // 3. Update status in chat history
        message.suggestion.status = 'ACCEPTED';
        await this.repo.updateMessage(message, client);
    }

    /**
     * Persist a single chat message to the database.
     * Call from the stream route to save the user message before streaming and the assistant message after the stream completes.
     */
    public async addMessageToDatabase(
        sessionId: string,
        sender: 'user' | 'assistant',
        content: string,
        client: SupabaseClient
    ): Promise<void> {
        if (!content?.trim()) return;
        const message: ChatMessage = {
            messageId: uuidv4(),
            sessionId,
            sender,
            content: content.trim(),
            timestamp: new Date()
        };
        await this.repo.addMessage(sessionId, message, client);
        if (sender === 'user') {
            await this.repo.updateSessionTimestamp(sessionId, new Date(), client);
        }
    }

    /**
     * Extract the latest user message text from a stream request body (messages array or message/content fields).
     * Returns null if none found.
     */
    public getLastUserMessageTextFromBody(body: {
        messages?: Array<{ role?: string; sender?: string; content?: string; parts?: Array<{ type?: string; text?: string }> }>;
        message?: string;
        input?: string;
        prompt?: string;
    }): string | null {
        const messages = body?.messages;
        if (Array.isArray(messages) && messages.length > 0) {
            for (let i = messages.length - 1; i >= 0; i--) {
                const m = messages[i];
                const who = (m?.sender ?? m?.role ?? '').toString().toLowerCase();
                if (who === 'user') {
                    const content = m.content ?? m.parts;
                    if (typeof content === 'string') return content.trim() || null;
                    if (Array.isArray(content)) {
                        for (const p of content) {
                            if (p?.type === 'text' && p?.text) return String(p.text).trim() || null;
                        }
                    }
                    return null;
                }
            }
        }
        if (body?.message && typeof body.message === 'string') return body.message.trim() || null;
        if (body?.input && typeof body.input === 'string') return body.input.trim() || null;
        if (body?.prompt && typeof body.prompt === 'string') return body.prompt.trim() || null;
        return null;
    }

    /**
     * Start a new chat for a specific report or project
     */
    public async startSession(userId: string, projectId: string, client: SupabaseClient, reportId?: string): Promise<ChatSession> {
        const newSession: ChatSession = {
            sessionId: uuidv4(),
            userId,
            projectId,
            reportId, // Optional: links chat to a specific report
            messages: [],
            startedAt: new Date(),
            lastActiveAt: new Date()
        };

        await this.repo.createSession(newSession, client);
        return newSession;
    }

    /*
     * ✅ HYBRID SIMPLIFIED: Extracts raw markdown for the AI to read.
     * We no longer need to loop through 'children' because the 
     * Markdown string in 'content' already contains the full text.
     */
    private sectionToText(section: any): string {
        if (!section) return '';

        // In the new schema, 'content' is the source of truth for the text
        const body = section.content || '';

        // We provide the heading as a reference so the AI knows the context,
        // but we label it clearly so the AI doesn't think it's part of the editable body
        return `SECTION TITLE: ${section.heading}\n\n${body}`.trim();
    }
}
