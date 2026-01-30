import { ChatSession, ChatMessage } from "../chat/chat.types";
import { SupabaseClient } from "@supabase/supabase-js";

export interface ChatRepository {
    // --- Retrieval ---
    
    // Find an existing conversation context
    getSessionById(sessionId: string, client: SupabaseClient): Promise<ChatSession | null>;

    // Find a session by report ID (so we reuse the session the trigger created instead of creating a duplicate)
    getSessionByReportId(reportId: string, client: SupabaseClient): Promise<ChatSession | null>;
    
    // Get all chats for a project (for the Sidebar UI)
    getSessionsByProject(projectId: string, client: SupabaseClient): Promise<ChatSession[]>;

    // --- Creation & Updates ---

    // Initialize a new chat session
    createSession(session: ChatSession, client: SupabaseClient): Promise<void>;
    
    // Add a new message bubble to history
    addMessage(sessionId: string, message: ChatMessage, client: SupabaseClient): Promise<void>;
    
    // NEW: Update an existing message (e.g., changing status to 'ACCEPTED')
    updateMessage(message: ChatMessage, client: SupabaseClient): Promise<void>;

    // NEW: Update the 'lastActiveAt' time so recent chats float to the top
    updateSessionTimestamp(sessionId: string, lastActiveAt: Date, client: SupabaseClient): Promise<void>;
}
// First, we define the rules for saving chats. We don't care how (Postgres/Mongo), just what needs to happen.