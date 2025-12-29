// A conversation history
export interface ChatSession {
    sessionId: string;
    projectId: string;       // Context: Which project is this about?
    reportId?: string;       // Optional: Which specific report are we editing?
    userId: string;
    
    messages: ChatMessage[];
    startedAt: Date;
    lastActiveAt: Date;
}

// A single message bubble
export interface ChatMessage {
    messageId: string;
    sessionId: string;
    sender: 'USER' | 'AI';
    content: string;         // The text displayed
    
    // AI Metadata (Only present if sender === 'AI')
    citations?: string[];    // IDs of RAG chunks used to answer
    suggestion?: EditSuggestion; // If the AI is proposing a text change
    
    timestamp: Date;
}

// The "Smart" part: Structured data for UI Diffing
export interface EditSuggestion {
    targetSectionId: string; // Which paragraph/section to change
    originalText: string;
    suggestedText: string;
    reason: string;          // "Correcting grammar" or "Adding missing spec"
    status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
}