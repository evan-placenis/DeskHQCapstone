// infrastructure/agents/ToolAgent.ts

import { ReportToolAction, ReportToolsSchema } from "../../../domain/chat/tools/definitions";
import OpenAI from "openai";

export class ToolAgent {
  constructor(private client: OpenAI) {}

  public async determineAction(
    userQuery: string, 
    contextMarkdown: string
  ): Promise<ReportToolAction | null> {

    const systemPrompt = `
      You are the Tool Execution Engine.
      Your job is to map User Requests to specific JSON Actions.
      
      CONTEXT:
      ${contextMarkdown}
      
      AVAILABLE TOOLS:
      1. SWAP_IMAGE: Use this when user wants to change/replace a picture.
      2. REORDER_BULLETS: Use this when user wants to change the sequence of points.

      RULES:
      - Extract the 'targetImageId' accurately from the Context Markdown (e.g. [IMAGE_ID: 123...]).
      - Return STRICT JSON matching the schema.
    `;

    // Call LLM with Structured Output enforcement
    const response = await this.client.chat.completions.create({
      model: "gpt-4o", // or gpt-4o
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userQuery }
      ],
      // If supported, use native tool calling. If not, use JSON mode:
      // response_format: { type: "json_object" } 
    });

    const content = response.choices[0].message.content;
    if (!content) return null;

    try {
      // Parse and Validate against our Zod Schema
      const parsed = JSON.parse(content);
      return ReportToolsSchema.parse(parsed); // Throws error if LLM hallucinated params
    } catch (e) {
      console.error("Tool Agent failed to parse action:", e);
      return null;
    }
  }
}
