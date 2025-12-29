import OpenAI from "openai";
import { AgentStrategy, AgentExecutionContext } from "../interfaces";
// === THE BRAINS (AI Models) ===

export class GrokAgent implements AgentStrategy {
  private client: OpenAI;

  // ✅ INJECTION: We ask for the client in the constructor
  constructor(client: OpenAI) {
      this.client = client;
  }

  //still need to figure out how to implement the context of (image and text or text-only)
  async generateContent(systemPrompt: string, userMessage: string, context: AgentExecutionContext): Promise<string> {
    const completion = await this.client.chat.completions.create({
            model: "grok-3",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userMessage },
            ],
        });
        return completion.choices[0].message.content || "";
  }
}