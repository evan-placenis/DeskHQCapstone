import OpenAI from "openai";
import { AgentStrategy, AgentExecutionContext } from "../interfaces";
// === THE BRAINS (AI Models) ===

export class GrokAgent implements AgentStrategy {
  private client: OpenAI;

  // ✅ INJECTION: We ask for the client in the constructor
  constructor(client: OpenAI) {
      this.client = client;
  }

  async generateContent(
      systemPrompt: string, 
      userMessage: string, 
      context?: AgentExecutionContext,
      onStream?: (chunk: string) => void
  ): Promise<string> {
    
    // 1. If streaming is requested, use the stream API
    if (onStream) {
        const stream = await this.client.chat.completions.create({
            model: "grok-3",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userMessage },
            ],
            stream: true,
        });

        let fullContent = "";
        for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || "";
            if (content) {
                fullContent += content;
                onStream(content);
            }
        }
        return fullContent;
    }

    // 2. Otherwise, standard await
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
