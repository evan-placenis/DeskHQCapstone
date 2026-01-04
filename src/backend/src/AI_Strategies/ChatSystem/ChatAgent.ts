import { ChatSession, ChatMessage, EditSuggestion } from "../../domain/chat/chat.types";
import { AgentStrategy } from "../strategies/interfaces";
import { AgentFactory } from "../factory/AgentFactory"; // Re-use your factory!
import { v4 as uuidv4 } from 'uuid';

export class ChatAgent {
    
    private llm: AgentStrategy;

    constructor() { //check if new agent is made for each message
        // We can reuse the same strategies (Grok) for Chat
        const factory = new AgentFactory();
        this.llm = factory.createStrategy("Grok"); 
    }

    /**
     * The main entry point. User sends text -> AI returns a Message.
     */
    public async processUserMessage(
        session: ChatSession, 
        userQuery: string
    ): Promise<ChatMessage> {
        
        console.log(`💬 ChatAgent: Processing "${userQuery}" for Project ${session.projectId}`);

        // 1. Check intent: Is this a question or an edit request?
        // (In a real app, you'd ask the LLM to classify the intent first)
        const isEditRequest = userQuery.toLowerCase().includes("change") || userQuery.toLowerCase().includes("rewrite");

        let responseContent = "";
        let suggestion: EditSuggestion | undefined = undefined;

        if (isEditRequest && session.reportId) {
            // --- EDIT MODE ---
            // Logic: "Change the observation section to mention water damage"
            responseContent = "I've drafted a change for the Observation section.";
            
            suggestion = {
                targetSectionId: "section_obs_1", // In reality, AI finds this ID
                originalText: "The concrete is dry.",
                suggestedText: "The concrete shows significant signs of water damage.",
                reason: "User requested update based on new findings.",
                status: 'PENDING'
            };

        } else {
            // --- RAG Q&A MODE ---
            // Logic: "What is the concrete strength requirement?"
            // 1. Retrieve RAG context (Placeholder)
            const context = ["Spec 4.2: Concrete must be 4000psi"];
            
            // 2. Ask LLM
            // We create a dummy context object here to satisfy the interface
            // In reality, you'd make a specific ChatContext type
            responseContent = `Based on the specs, the requirement is 4000psi.`;
        }

        // 3. Construct the AI Message
        const aiMessage: ChatMessage = {
            messageId: uuidv4(),
            sessionId: session.sessionId,
            sender: 'AI',
            content: responseContent,
            suggestion: suggestion, // Attach the diff if it exists
            timestamp: new Date()
        };

        return aiMessage;
    }
}


// Do you see the suggestion field in the ChatMessage?

// On the Frontend (React): When you receive a message with a suggestion object, you don't just show text bubbles. You can render a "Review Change" Card .

// The User Action: The user clicks "Accept" or "Reject" on that card.

// The Result: If "Accept" is clicked, your React app updates the Report state directly with