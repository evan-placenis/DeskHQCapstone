// domain/agents/interfaces.ts
import { ChatMessage } from "../../domain/chat/chat.types";
import { z } from 'zod/v3';
// Define the allowed actions
const StepSchema = z.object({
    intent: z.enum(["RESEARCH_DATA", "EDIT_TEXT", "EXECUTE_TOOL", "RESPOND"]),
    instruction: z.string().describe("Specific instruction for this step (e.g. 'Search for iPhone weight')"),
    reasoningText: z.string().describe("Why this step is needed")
});

export const PlanSchema = z.object({
    steps: z.array(StepSchema).describe("An ordered list of steps to execute the user's request.")
});

export type ExecutionPlan = z.infer<typeof PlanSchema>;

export interface EditorResponse {
    content: string; // The new Markdown text
    reasoningText: string; // Technical: "Fixed grammar in para 2"
    chatMessage: string; // Conversational: "I've updated the intro to mention the new roofing specs."
}

export interface IChatEditor {
    /**
     * Takes existing text and instructions, returns the rewritten version.
     */
    rewriteSection(originalText: string, instruction: string): Promise<EditorResponse>;
}

export interface IChatResearcher {
    findAnswer(query: string, projectId: string): Promise<{ content: string, sources: string[] }>;
}

export interface IPlannerAgent {
    generatePlan(userQuery: string, contentType?: string, history?: ChatMessage[]): Promise<ExecutionPlan>;
}

export interface IToolAgent {
    // We need this interface if we are going to support tools!
    determineAction(userQuery: string, contextMarkdown: string): Promise<any>;
}

export interface IChatResponder {
    /**
     * Generates a conversational response to answer questions or provide guidance
     * without making edits to the document.
     */
    generateResponse(query: string, context?: string): Promise<string>;
}