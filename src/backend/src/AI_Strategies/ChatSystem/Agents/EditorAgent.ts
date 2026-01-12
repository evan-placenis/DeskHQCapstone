// agents/ChatEditor.ts
import { AgentStrategy } from "../../strategies/interfaces";
import { IChatEditor } from "../interfaces";

// Define the shape we want the AI to return internally
type EditorOutput = {
    content: string;
    reasoning: string;
};

export class ChatEditor implements IChatEditor {
    
    constructor(private agent: AgentStrategy) {}

    // 🟢 FIX: Return type now matches the Interface
    public async rewriteSection(originalText: string, instruction: string): Promise<{ content: string; reasoning: string }> {
        
        const systemPrompt = `
            You are a strict Technical Editor.
            
            TASK:
            Rewrite the 'Original Content' based on the 'User Instruction'.
            
            OUTPUT RULES:
            1. Return strictly valid JSON.
            2. Match this structure: { "content": "...", "reasoning": "..." }
            3. In 'content', use Markdown Bullet Points (- item).
            4. In 'reasoning', give a 5-word summary of what you changed (e.g. "Fixed typos and condensed text").
            5. PRESERVE IMAGES: Keep '> [IMAGE: ...]' lines attached to their bullets.
        `;

        const userMessage = `
            USER INSTRUCTION:
            "${instruction}"
            
            ORIGINAL CONTENT:
            ${originalText}
        `;

        try {
            // 1. Call LLM
            const responseText = await this.agent.generateContent(
                systemPrompt,
                userMessage,
                undefined 
            );

            // 2. Parse JSON safely
            const cleanText = responseText.replace(/```json|```/g, "").trim();
            const parsed = JSON.parse(cleanText) as EditorOutput;

            return parsed;

        } catch (error) {
            console.error("Editor failed to parse JSON, falling back to raw text:", error);
            
            // Fallback: If JSON parsing fails, return the original or raw text
            // so the app doesn't crash.
            return {
                content: originalText, 
                reasoning: "Error: AI formatting failed."
            };
        }
    }
}