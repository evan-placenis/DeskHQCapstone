import { ChatRepository } from "../domain/interfaces/ChatRepository";
import { ChatOrchestrator } from "../AI_Skills/orchestrators/ChatOrchestrator";
import { ChatSession, ChatMessage } from "../domain/chat/chat.types";
import { v4 as uuidv4 } from 'uuid';
import { ReportService } from "./ReportService";
import { SupabaseClient } from "@supabase/supabase-js";
import { DiffUtils } from "../AI_Strategies/ChatSystem/diffUtils/DiffUtils";

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
export class ChatServiceNew {

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
        provider: 'grok' | 'gemini' | 'claude' = 'grok'
    ): Promise<ChatMessage> {

        // 1. Fetch Session
        const session = await this.repo.getSessionById(sessionId, client);
        if (!session) throw new Error("Session not found");

        // 2. Save USER Message
        const userMsg: ChatMessage = {
            messageId: uuidv4(),
            sessionId: sessionId,
            sender: 'USER',
            content: userText,
            timestamp: new Date()
        };
        await this.repo.addMessage(sessionId, userMsg, client);
        await this.repo.updateSessionTimestamp(sessionId, new Date(), client);

        // 3. 🔍 FETCH CONTEXT (The "Glue")
        // If the user is currently editing a specific section, the AI needs to "see" it.
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

        // 4. Build messages array for AI-SDK
        const recentMessages = session.messages.slice(-10); // Last 10 messages for context
        const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
            ...recentMessages.map(msg => ({
                role: (msg.sender === 'USER' ? 'user' : 'assistant') as 'user' | 'assistant',
                content: msg.content
            })),
            { role: 'user' as const, content: userText }
        ];

        // Build system message if we have report context
        let systemMessage: string | undefined = undefined;
        if (reportContext) {
            const contextText = this.sectionToText(reportContext);
            systemMessage = `You are helping edit a report section. Current section content:\n\n${contextText}\n\nWhen the user asks to edit this section, use the updateSection tool.`;
        }

        // 5. Call AI-SDK Orchestrator
        const streamResult = await this.chatOrchestrator.generateStream({
            messages,
            provider,
            context: reportContext,
            projectId: session.projectId,
            userId: session.userId,
            systemMessage
        });

        // 6. Process the stream and extract final text
        // Note: For now, we'll collect the full text. In the future, you might want to stream this.
        let fullText = '';

        for await (const chunk of streamResult.textStream) {
            fullText += chunk;
        }

        // Get the final result to check for tool calls
        const result = await streamResult;
        let suggestion: any = undefined;

        // If we have report context and the AI made tool calls, check for updateSection
        // Note: toolCalls from AI-SDK might be a promise or async iterable
        if (reportContext && activeSectionId) {
            try {
                let toolCallsArray: any[] = [];
                if (result.toolCalls) {
                    // Check if it's a promise
                    if (result.toolCalls instanceof Promise) {
                        toolCallsArray = await result.toolCalls;
                    } else {
                        // Try as async iterable
                        try {
                            for await (const toolCall of result.toolCalls as any) {
                                toolCallsArray.push(toolCall);
                            }
                        } catch {
                            // If not iterable, try as array
                            toolCallsArray = Array.isArray(result.toolCalls) ? result.toolCalls : [];
                        }
                    }
                }
                
                const updateSectionCall = toolCallsArray.find((call: any) => call.toolName === 'updateSection');
                
                if (updateSectionCall) {
                    // Get original text from section description
                    const originalText = this.sectionToText(reportContext);
                    const suggestedText = updateSectionCall.args?.markdown || fullText;

                    // Calculate diff - computeDiff returns Change[], calculateDiffStats returns stats
                    const changes = DiffUtils.computeDiff(originalText, suggestedText);
                    const stats = DiffUtils.calculateDiffStats(originalText, suggestedText);

                    suggestion = {
                        targetSectionId: activeSectionId,
                        originalText,
                        suggestedText,
                        reason: "AI suggested edit based on your request",
                        status: 'PENDING' as const,
                        changes: changes,
                        stats: stats
                    };
                }
            } catch (error) {
                console.error("Error processing tool calls:", error);
                // Continue without suggestion if tool call processing fails
            }
        }

        // 7. Save AI Message
        const aiMsg: ChatMessage = {
            messageId: uuidv4(),
            sessionId: sessionId,
            sender: 'AI',
            content: fullText,
            suggestion,
            timestamp: new Date()
        };
        await this.repo.addMessage(sessionId, aiMsg, client);

        return aiMsg;
    }

    /**
     * LOGIC: User clicked "Accept" on the UI. 
     * We must apply the AI's fix to the real Report.
     */
    public async acceptSuggestion(sessionId: string, messageId: string, client: SupabaseClient): Promise<void> {

        // 1. Validation Logic
        const session = await this.repo.getSessionById(sessionId, client);
        if (!session) throw new Error("Session not found");
        if (!session.reportId) throw new Error("No report linked to this chat");

        const message = session.messages.find(m => m.messageId === messageId);
        if (!message || !message.suggestion) throw new Error("Suggestion not found");

        // 2. 📞 CALL THE REPORT SERVICE
        await this.reportService.updateSectionContent(
            session.projectId,
            session.reportId,
            message.suggestion.targetSectionId,
            message.suggestion.suggestedText,
            client
        );

        // 3. Update Chat Status
        message.suggestion.status = 'ACCEPTED';
        await this.repo.updateMessage(message, client);
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

    /**
     * Helper: Convert section object to readable text format
     * Since we're using Tiptap, we just extract the description and title
     */
    private sectionToText(section: any): string {
        if (!section) return '';

        let text = '';
        
        // Add title if available
        if (section.title) {
            text += `# ${section.title}\n\n`;
        }

        // Add description (main content)
        if (section.description) {
            text += section.description;
        }

        // Add children (subsections) if available
        if (section.children && Array.isArray(section.children) && section.children.length > 0) {
            text += '\n\n';
            section.children.forEach((child: any, index: number) => {
                if (child.title) {
                    text += `## ${child.title}\n\n`;
                }
                if (child.description) {
                    text += `${child.description}\n\n`;
                }
            });
        }

        return text.trim();
    }
}
