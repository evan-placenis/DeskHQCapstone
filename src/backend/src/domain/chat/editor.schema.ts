import { z } from 'zod/v3';

// 1. The Router Schema
export const RouterSchema = z.object({
    intent: z.enum(["EDIT_TEXT", "RESEARCH_DATA", "EXECUTE_TOOL", "RESPOND"]),
    reasoningText: z.string(),
    complexity: z.enum(["LOW", "HIGH"]),
  });
  
  // 2. The Editor Schema
  // Even though we want a string back, wrapping it in JSON makes it safer 
  // against "conversational" drift (e.g. "Sure! Here is the text...")
  export const EditorResponseSchema = z.object({
    modified_text: z.string().describe("The fully rewritten text block."),
    change_summary: z.string().describe("A very short (5 words) summary of what changed."),
  });
  
  // TypeScript type inference
  export type EditorResponse = z.infer<typeof EditorResponseSchema>;