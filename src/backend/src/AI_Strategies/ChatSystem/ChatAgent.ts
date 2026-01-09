import { ChatSession, ChatMessage, EditSuggestion } from "../../domain/chat/chat.types";
import { AgentStrategy } from "../strategies/interfaces";
// import { AgentFactory } from "../factory/AgentFactory"; 
import { GrokAgent } from "../strategies/LLM/Grok";
import { getGrokClient } from "../../infrastructure/llm/grokClient";
import { v4 as uuidv4 } from 'uuid';

export class ChatAgent {
    
    private llm: AgentStrategy;

    constructor() { 
        // Direct instantiation to avoid circular dependency/KnowledgeService requirement in Factory
        this.llm = new GrokAgent(getGrokClient()); 
    }

    /**
     * The Brain 🧠
     * Now accepts 'reportContext' (the Markdown string of the section being viewed)
     */
    public async processUserMessage(
        session: ChatSession, 
        userQuery: string,
        reportContext?: string // 👈 NEW: The "View" from the ReportService
    ): Promise<ChatMessage> {
        
        console.log(`💬 ChatAgent: Processing "${userQuery}"`);

        // 1. DETERMINE INTENT (Simulated)
        // If we have reportContext, the user is likely looking at a section, so we prioritize editing.
        const isEditRequest = (userQuery.toLowerCase().includes("change") || userQuery.toLowerCase().includes("rewrite")) && !!reportContext;

        let responseContent = "";
        let suggestion: EditSuggestion | undefined = undefined;

        if (isEditRequest && reportContext) {
            // --- ✏️ HYBRID EDIT MODE ---
            
            // 🛑 REAL LLM CALL WOULD LOOK LIKE THIS:
            /* const prompt = `
                You are a technical editor. 
                Task: Rewrite the following Markdown content based on the User Instruction.
                
                USER INSTRUCTION: "${userQuery}"
                
                CURRENT CONTENT (Markdown):
                ${reportContext}
                
                Output only the new Markdown.
            `;
            const newMarkdown = await llm.generate(prompt); 
            */

            // ⚡ MOCK RESPONSE (Simulating the LLM's output)
            // Pretend the LLM rewrote the markdown
            const mockNewMarkdown = `${reportContext}\n\n(Updated: ${userQuery})`; 

            responseContent = "I've drafted a change for this section based on your request.";
            
            suggestion = {
                targetSectionId: "active_section_id", // In reality, you pass this ID in or infer it
                originalText: reportContext,          // The "Before" state
                suggestedText: mockNewMarkdown,       // The "After" state (Markdown)
                reason: "User requested update via chat.",
                status: 'PENDING'
            };

        } else {
            // --- 🔍 RAG Q&A MODE ---
            // If no context was provided, or user asked a general question
            
            // 1. Retrieve RAG context (Placeholder)
            const retrievedDocs = ["Spec 4.2: Concrete must be 4000psi"];
            
            // 2. Ask LLM
            responseContent = `Based on the specs, the requirement is 4000psi.`;
        }

        // 3. Construct the AI Message
        const aiMessage: ChatMessage = {
            messageId: uuidv4(),
            sessionId: session.sessionId,
            sender: 'AI',
            content: responseContent,
            suggestion: suggestion, // Attach the 'diff' object
            timestamp: new Date()
        };

        return aiMessage;
    }
}


// Do you see the suggestion field in the ChatMessage?

// On the Frontend (React): When you receive a message with a suggestion object, you don't just show text bubbles. You can render a "Review Change" Card .

// The User Action: The user clicks "Accept" or "Reject" on that card.

// The Result: If "Accept" is clicked, your React app updates the Report state directly with