import { ChatRepository } from "../domain/interfaces/ChatRepository";
import { ChatAgent } from "../AI_Strategies/ChatSystem/ChatAgent";
import { ChatSession, ChatMessage } from "../domain/chat/chat.types";
import { v4 as uuidv4 } from 'uuid';
import { ReportService } from "./ReportService";

import { SupabaseClient } from "@supabase/supabase-js";

export class ChatService {
    
    // Dependencies
    private repo: ChatRepository;
    private chatAgent: ChatAgent;
    private reportService: ReportService;

    constructor(repo: ChatRepository, reportService: ReportService, chatAgent: ChatAgent) {
        this.repo = repo;
        this.chatAgent = chatAgent;
        this.reportService = reportService;
    }

    /**
     * The Main Function: Handles the full loop
     */
    public async handleUserMessage(
        sessionId: string, 
        userText: string,
        client: SupabaseClient
    ): Promise<ChatMessage> {
        
        // 1. Fetch Context (Load the session history)
        const session = await this.repo.getSessionById(sessionId, client);
        if (!session) throw new Error("Session not found");

        // 2. Save USER Message to DB
        const userMsg: ChatMessage = {
            messageId: uuidv4(),
            sessionId: sessionId,
            sender: 'USER',
            content: userText,
            timestamp: new Date()
        };
        await this.repo.addMessage(sessionId, userMsg, client);

        await this.repo.updateSessionTimestamp(sessionId, new Date(), client);

        // 3. Ask the AI (The Brain) 🧠
        // We pass the session so the AI knows the project context
        const aiMsg = await this.chatAgent.processUserMessage(session, userText);

        // 4. Save AI Message to DB
        await this.repo.addMessage(sessionId, aiMsg, client);

        // 5. Return the AI response so the UI can show it immediately
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


// This is the "Glue". The Controller shouldn't talk to the AI directly; it should ask the Service to "handle the message."
 // The Service does 3 things:

// Saves the User's message to the DB.

// Calls the AI Agent to get an answer.

// Saves the AI's response to the DB.