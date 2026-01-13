import { AgentStrategy } from "../../strategies/interfaces";
import { ExecutionPlan } from "../interfaces";
import { PlannerExampleTemplate } from "../../../domain/chat/Templates/chat_templates";
import { ChatMessage } from "../../../domain/chat/chat.types";

export class PlannerAgent {
    constructor(private agent: AgentStrategy) {}
  
    public async generatePlan(userQuery: string, contentType?: any, history?: ChatMessage[]): Promise<ExecutionPlan> {
      
      const hasContext = !!contentType;
      
      let contextDescription = "None";
      if (hasContext) {
         if (typeof contentType === 'string') {
             contextDescription = contentType;
         } else if (typeof contentType === 'object') {
             contextDescription = contentType.title || contentType.id || "Report Section";
         }
      }

      const contextGuide = hasContext
        ? `User is viewing: '${contextDescription}'. EDIT_TEXT and EXECUTE_TOOL can be used on this content.`
        : `User is NOT viewing a section. EDIT_TEXT/EXECUTE_TOOL can be used if the user makes it clear what section they want processed.`;

      let historyContext = "";
      if (history && history.length > 0) {
        historyContext = history.map(msg => 
            `[${msg.sender}]: ${msg.content}`
        ).join("\n");
      }

      // 1. INJECT THE TEMPLATE INTO THE PROMPT
      const systemPrompt = `
        You are the Execution Planner.
        Break the User Query down into sequential steps.
        
        CONTEXT STATUS:
        ${contextGuide}

        RECENT CHAT HISTORY:
        ${historyContext}

        AVAILABLE INTENTS:
        1. RESEARCH_DATA: Find external facts/specs.
        2. EDIT_TEXT: Modify the text/content (Requires Context).
        3. EXECUTE_TOOL: Structural changes like 'swap image' (Requires Context).

        OUTPUT INSTRUCTIONS:
        - You must output strictly valid JSON.
        - Your JSON must match the exact structure of this example:
        
        ${JSON.stringify(PlannerExampleTemplate, null, 2)}
        
        - Do not include markdown formatting (like \`\`\`json). Just the raw object.
      `;
  
      try {
        // 2. CALL LLM (Standard Text Generation)
        const responseText = await this.agent.generateContent(systemPrompt, userQuery);

        // 3. PARSE SAFELY (Your custom logic)
        // This replaces the Zod validation step.
        return this.parseJsonSafely<ExecutionPlan>(responseText);

      } catch (error) {
        console.error("Planner Agent failed:", error);
        throw error;
      }
    }

    /**
     * Your Safe Parser Helper
     * (Included here for completeness, though likely lives in a utils file)
     */
    private parseJsonSafely<T>(text: string): T {
        // 1. Strip Markdown fences if the AI adds them
        const cleanText = text.replace(/```json|```/g, "").trim();
        
        // 2. Parse
        const parsed = JSON.parse(cleanText);
        
        // 3. (Optional) Basic Runtime Check
        // Since we don't have Zod, we might check one key field just to be safe.
        if (!parsed.steps || !Array.isArray(parsed.steps)) {
            throw new Error("Invalid JSON Structure: Missing 'steps' array");
        }

        return parsed as T;
    }
}