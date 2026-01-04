import { ChatSession, ChatMessage } from "../chat/chat.types";

export interface ChatRepository {
    // --- Retrieval ---
    
    // Find an existing conversation context
    getSessionById(sessionId: string): Promise<ChatSession | null>;
    
    // Get all chats for a project (for the Sidebar UI)
    getSessionsByProject(projectId: string): Promise<ChatSession[]>;

    // --- Creation & Updates ---

    // Initialize a new chat session
    createSession(session: ChatSession): Promise<void>;
    
    // Add a new message bubble to history
    // Updated to match your Service call: addMessage(sessionId, message)
    addMessage(sessionId: string, message: ChatMessage): Promise<void>;
    
    // NEW: Update an existing message (e.g., changing status to 'ACCEPTED')
    updateMessage(message: ChatMessage): Promise<void>;

    // NEW: Update the 'lastActiveAt' time so recent chats float to the top
    updateSessionTimestamp(sessionId: string, lastActiveAt: Date): Promise<void>;
}
// First, we define the rules for saving chats. We don't care how (Postgres/Mongo), just what needs to happen.