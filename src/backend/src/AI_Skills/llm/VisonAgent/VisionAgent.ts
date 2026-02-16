import OpenAI from "openai";
import { VisionAnalysis } from "../interfaces";
import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";
import { IMAGE_ANALYSIS_SYSTEM_PROMPT, SPEC_IMAGE_ANALYSIS_SYSTEM_PROMPT } from "../prompts/image/VisionPrompts";
import pLimit from 'p-limit'; // Import the queue manager
import axios from 'axios'; // You'll likely need axios or fetch to get the image buffer for Gemini

// Update the interface for the batch input
export interface VisionBatchRequest {
  id: string;
  url: string;
}

// 1. Add this helper at the top of the file (outside the class)
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export class VisionAgent {
  private _openaiClient: OpenAI | undefined;
  private _geminiClient: GoogleGenerativeAI | undefined;

  private IMAGE_ANALYSIS_SYSTEM_PROMPT: string;
  private SPEC_IMAGE_ANALYSIS_SYSTEM_PROMPT: string;
  constructor() {
    // This prompt forces the model to be objective and technical
    this.IMAGE_ANALYSIS_SYSTEM_PROMPT = IMAGE_ANALYSIS_SYSTEM_PROMPT;
    this.SPEC_IMAGE_ANALYSIS_SYSTEM_PROMPT = SPEC_IMAGE_ANALYSIS_SYSTEM_PROMPT;
  }

  // Lazy load OpenAI
  private get openai(): OpenAI {
    if (!this._openaiClient) {
      this._openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
    return this._openaiClient;
  }

  // Lazy load Gemini
  private get gemini(): GoogleGenerativeAI {
    if (!this._geminiClient) {
      if (!process.env.GOOGLE_API_KEY) throw new Error("GOOGLE_API_KEY is missing");
      this._geminiClient = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
    }
    return this._geminiClient;
  }

  /**
   * Helper: Fetches a public URL and converts it to the Base64 format Gemini expects.
   */
  private async urlToGenerativePart(url: string) {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    const mimeType = response.headers['content-type'] || 'image/jpeg';
    return {
      inlineData: {
        data: Buffer.from(response.data).toString('base64'),
        mimeType
      },
    };
    
  }

  

  /**
   * Analyzes a single image and returns a technical description.
   * @param imageUrl - The public URL of the image or a base64 string.
   * @param imageId - Optional ID to track which image this belongs to.
   */
  async analyzeImage(
    imageUrl: string, 
    imageId: string = "unknown", 
    task: 'imageAnalysis' | 'specImageAnalysis' = 'imageAnalysis',
    provider: 'openai' | 'gemini' = 'gemini',
  ): Promise<VisionAnalysis> {
    // Retry Settings
    const MAX_RETRIES = 3;
    let attempt = 0;

    while (attempt < MAX_RETRIES) {
      try {
        let description = "";
        let systemPrompt = "";
        if (task === 'imageAnalysis') {
          systemPrompt = this.IMAGE_ANALYSIS_SYSTEM_PROMPT;
        } else {
          systemPrompt = this.SPEC_IMAGE_ANALYSIS_SYSTEM_PROMPT;
        }

        if (provider === 'openai') {
          // --- OPENAI PATH ---
          // const response = await this.openai.chat.completions.create({
          //   model: "gpt-4o",
          //   messages: [
          //     { role: "system", content: systemPrompt},
          //     {
          //       role: "user",
          //       content: [
          //         { type: "text", text: "Describe the technical details in this image." },
          //         { type: "image_url", image_url: { url: imageUrl, detail: "high" } },
          //       ],
          //     },
          //   ],
          //   max_tokens: 500,
          // });
          // description = response.choices[0]?.message?.content || "No analysis generated.";

        } else {
          // --- GEMINI PATH ---
          // 1. Get the model
          const model = this.gemini.getGenerativeModel({ 
            model: "gemini-3-flash-preview", // Or "gemini-1.5-pro" if 3 is not yet available in your region
            systemInstruction: systemPrompt
          });

          // 2. Prepare image (Fetch & Base64 encode)
          const imagePart = await this.urlToGenerativePart(imageUrl);

          // CONSTRUCT THE PROMPT WITH CONTEXT
          let promptText = "Describe the technical details in this image.";

          // 3. Call API with High Resolution enforcement
          const result = await model.generateContent({
            contents: [{ role: 'user', parts: [imagePart, { text: promptText }] }],
            generationConfig: {
              // media_resolution: "MEDIA_RESOLUTION_HIGH", 
              temperature: 0.1, // Lower temp for factual spec reading
              maxOutputTokens: 2000,
              topP: 0.95,             // Standard sampling for factual accuracy
            }
          });

          description = result.response.text();
        }

        return {
          imageId,
          description,
          timestamp: new Date().toISOString(),
        };

      } catch (error:any) {
        attempt++;
        // Check if it's a "Retryable" error (503 Service Unavailable or 429 Too Many Requests)
        const isRetryable = error.status === 503 || error.status === 429 || error.message?.includes('Overloaded');

        if (isRetryable && attempt < MAX_RETRIES) {
          const delay = attempt * 500; // 0.5s, 1s, 1.5s — give Gemini time to recover from 503
          console.warn(`[VisionAgent] ⚠️ Attempt ${attempt} failed for image ${imageId} (${error.status || 'error'}). Retrying in ${delay}ms...`);
          await wait(delay);
          continue; // Restart the loop
        }
        console.error(`[VisionAgent] ❌ Final Error analyzing image ${imageId}:`, error);
        return {
          imageId,
          description: `Error: Could not analyze image with ${provider}.`,
          timestamp: new Date().toISOString(),
        };
      }
    }
    // Should technically be unreachable, but for TypeScript safety:
    return { imageId, description: "Error: Timeout", timestamp: new Date().toISOString() };
  }

  /**
   * Batch process multiple images in parallel (useful for full reports)
   */
  async analyzeBatch(images: VisionBatchRequest[], task: 'imageAnalysis' | 'specImageAnalysis'): Promise<VisionAnalysis[]> {
    // Keep concurrency low (3) to avoid "high demand" 503s from Gemini; stagger start to avoid burst
    const limit = pLimit(3);

    const promises = images.map((img) =>
      // Wrap your call in the limit function
      limit(() => this.analyzeImage(img.url, img.id, task))
    );

    return Promise.all(promises);
  }
}

// Export a singleton instance for easy import
export const visionAgent = new VisionAgent();