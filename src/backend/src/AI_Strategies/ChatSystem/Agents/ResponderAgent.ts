// agents/ResponderAgent.ts
import { AgentStrategy } from "../../strategies/interfaces";
import { IChatResponder } from "../interfaces";

/**
 * ResponderAgent handles conversational responses without making document edits.
 * Use this for answering questions, explaining concepts, or providing guidance.
 */
export class ResponderAgent implements IChatResponder {
    
    constructor(private agent: AgentStrategy) {}

    /**
     * Generates a helpful conversational response based on the user's query
     * and optional document context.
     */
    public async generateResponse(query: string, context?: string): Promise<string> {
        
        const systemPrompt = `
            You are a helpful AI assistant for technical report editing.
            
            YOUR ROLE:
            - Answer questions about the document or report content
            - Explain technical concepts or terminology
            - Provide guidance on what to include or how to improve sections
            - Clarify requirements or best practices
            - Help the user understand their options
            
            GUIDELINES:
            1. Be concise but thorough - aim for 2-4 sentences unless more detail is needed.
            2. If context is provided, reference specific parts of the document when relevant.
            3. Use a professional but friendly tone.
            4. If you don't have enough information to answer, say so and ask for clarification.
            5. Do NOT make edits to the document - just provide information and guidance.
            6. Use "I" when referring to yourself (e.g., "I can help you with...").
            
            OUTPUT:
            Return only your response text. No JSON formatting needed.
        `;

        const userMessage = context 
            ? `DOCUMENT CONTEXT:\n${context}\n\nUSER QUESTION:\n${query}`
            : `USER QUESTION:\n${query}`;

        try {
            const response = await this.agent.generateContent(
                systemPrompt,
                userMessage,
                undefined
            );

            // Clean up any accidental formatting
            return response.trim();

        } catch (error) {
            console.error("ResponderAgent failed:", error);
            return "I encountered an issue processing your question. Could you please rephrase it or try again?";
        }
    }
}
