import { ChatSession, ChatMessage } from "../chat/chat.types";

export interface ChatRepository {
    // Find an existing conversation
    getSessionById(sessionId: string): Promise<ChatSession | null>;
    
    // Create a new one
    createSession(session: ChatSession): Promise<void>;
    
    // Add a message bubble to history
    addMessage(message: ChatMessage): Promise<void>;
    
    // (Optional) Get all chats for a project
    getSessionsByProject(projectId: string): Promise<ChatSession[]>;
}

// First, we define the rules for saving chats. We don't care how (Postgres/Mongo), just what needs to happen.