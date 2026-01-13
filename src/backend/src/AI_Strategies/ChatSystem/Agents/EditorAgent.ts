// agents/ChatEditor.ts
import { AgentStrategy } from "../../strategies/interfaces";
import { IChatEditor } from "../interfaces";
import { EditorResponse } from "../interfaces";
export class ChatEditor implements IChatEditor {
    
    constructor(private agent: AgentStrategy) {}

    // 🟢 FIX: Return type now matches the Interface
    public async rewriteSection(originalText: string, instruction: string): Promise<EditorResponse> {
        
        const systemPrompt = `
            You are a strict Technical Editor.
            
            TASK:
            Rewrite the 'Original Content' based on the 'User Instruction'.
            
            OUTPUT RULES:
            1. Return strictly valid JSON.
            2. In 'content', use Markdown Bullet Points (- item).
            3. In 'reasoning', give a 5-word summary of what you changed (e.g. "Fixed typos and condensed text").
            4. PRESERVE IMAGES: Keep '> [IMAGE: ...]' lines attached to their bullets.

            OUTPUT FORMAT (JSON):
            {
                "content": "The fully rewritten markdown...",
                "reasoning": "Technical brief of changes (e.g., 'Integrated stats from 2024').",
                "chatMessage": "A natural, helpful sentence telling the user what you did. Use 'I'. Example: 'I have updated the section with the latest 2024 roofing stats for you.'"
            }
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
            const parsed = JSON.parse(cleanText) as EditorResponse;

            return parsed;

        } catch (error) {
            console.error("Editor failed to parse JSON, falling back to raw text:", error);
            
            // Fallback: If JSON parsing fails, return the original or raw text
            // so the app doesn't crash.
            return {
                content: originalText, 
                reasoning: "Error: AI formatting failed.",
                chatMessage: "Error: AI formatting failed."
            };
        }
    }
}