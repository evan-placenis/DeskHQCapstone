import { ChatRepository } from "../domain/interfaces/ChatRepository";
import { ChatOrchestrator } from "../AI_Strategies/ChatSystem/core/ChatOrchestrator";
import { ChatSession, ChatMessage } from "../domain/chat/chat.types";
import { v4 as uuidv4 } from 'uuid';
import { ReportService } from "./ReportService";

import { SupabaseClient } from "@supabase/supabase-js";

export class ChatService {
    
    // Dependencies
    private repo: ChatRepository;
    private ChatOrchestrator: ChatOrchestrator;
    private reportService: ReportService;

    constructor(repo: ChatRepository, reportService: ReportService, ChatOrchestrator: ChatOrchestrator) {
        this.repo = repo;
        this.ChatOrchestrator = ChatOrchestrator;
        this.reportService = reportService;
    }

    /**
     * The Main Function: Handles the full loop
     */
    public async handleUserMessage(
        sessionId: string, 
        userText: string,
        client: SupabaseClient,
        activeSectionId?: string, // 👈 New Optional Param: Is the user looking at a specific section?
        reportId?: string // 🟢 New Optional Param: Fallback if session doesn't have it
    ): Promise<ChatMessage> {
        
        // console.log(`🤖 ChatService: Handling message for session ${sessionId}`);
        // console.log(`📍 Active Section ID:`, activeSectionId || "None");

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
        // Always fetch the FULL report so AI has complete context (like Cursor with open files)
        let reportContext = "";
        
        // Use session.reportId OR the passed reportId
        const targetReportId = session.reportId || reportId;

        if (targetReportId) {
            // 🟢 Always fetch full report context - AI will parse section references from user's message
            try {
                reportContext = await this.reportService.getFullReportContextForAI(
                    targetReportId,
                    client
                );
                console.log(`✅ Full report context loaded (${reportContext.length} chars)`);
            } catch (error) {
                console.error(`⚠️ Failed to fetch report context:`, error);
            }
        } else {
            console.log(`⚠️ No context fetched. ReportId: ${targetReportId}, SectionId: ${activeSectionId}`);
        }

        // 4. Ask the AI 🧠
        // We pass the new 'reportContext' string to the Agent
        const aiMsg = await this.ChatOrchestrator.processUserMessage(
            session, 
            userText, 
            reportContext 
        );

        // 5. Save AI Message
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
        // "Hey ReportService, please update this section for me."
        await this.reportService.updateSectionContent(
            session.projectId,
            session.reportId,
            message.suggestion.targetSectionId,
            message.suggestion.suggestedText,
            client
        );

        // 3. Update Chat Status
        message.suggestion.status = 'ACCEPTED';
        // await this.repo.updateMessage(message); (Implement this in your repo)

        // 3. CRITICAL: Persist the status change to the DB
        // You need to implement updateMessage in your repo
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
}
