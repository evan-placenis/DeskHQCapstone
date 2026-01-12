// domain/agents/interfaces.ts
import { z } from "zod";
// Define the allowed actions
const StepSchema = z.object({
    intent: z.enum(["RESEARCH_DATA", "EDIT_TEXT", "EXECUTE_TOOL"]),
    instruction: z.string().describe("Specific instruction for this step (e.g. 'Search for iPhone weight')"),
    reasoning: z.string().describe("Why this step is needed")
  });
  
  export const PlanSchema = z.object({
    steps: z.array(StepSchema).describe("An ordered list of steps to execute the user's request.")
  });
  
  export type ExecutionPlan = z.infer<typeof PlanSchema>;
  


export interface IChatEditor {
    /**
     * Takes existing text and instructions, returns the rewritten version.
     */
    rewriteSection(originalText: string, instruction: string): Promise<{content: string, reasoning: string}>;
}

export interface IChatResearcher {
    findAnswer(query: string): Promise<{content: string, sources: string[]}>;
}

export interface IPlannerAgent {
    generatePlan(userQuery: string, contentType?: string): Promise<ExecutionPlan>;
}

export interface IToolAgent {
    // We need this interface if we are going to support tools!
    determineAction(userQuery: string, contextMarkdown: string): Promise<any>; 
}