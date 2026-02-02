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

// A single message bubble (sender matches DB column: user | assistant)
export interface ChatMessage {
    messageId: string;
    sessionId: string;
    sender: 'user' | 'assistant';
    content: string;
    citations?: string[];
    suggestion?: EditSuggestion;
    timestamp: Date;
}

// The "Smart" part: Structured data for UI Diffing
export interface EditSuggestion {
    targetSectionId: string; // Which paragraph/section to change
    originalText: string;
    suggestedText: string;
    reason: string;          // "Correcting grammar" or "Adding missing spec"
    status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
    changes: DiffChange[]; // The raw array for rendering green/red text
    stats: DiffStats;      // The summary data (e.g. "+5 words")
    suggestedData?: any;     // 🟢 NEW: Structured JSON version of the suggested text
}

// 1. The shape of a single text change (matches the 'diff' library output)
export interface DiffChange {
    value: string;
    added?: boolean;
    removed?: boolean;
}

// 2. The statistics for the summary
export interface DiffStats {
    added: number;
    removed: number;
    changeSummary: string;
    hasChanges: boolean;
}