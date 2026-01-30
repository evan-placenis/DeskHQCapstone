import OpenAI from "openai";
import { VisionAnalysis } from "../interfaces";
import { IMAGE_ANALYSIS_SYSTEM_PROMPT } from "../prompts/image/imageAnalysisPrompt";
import pLimit from 'p-limit'; // Import the queue manager


export class VisionAgent {
  private _client: OpenAI | undefined;
  private IMAGE_ANALYSIS_SYSTEM_PROMPT: string;

  constructor() {
    // This prompt forces the model to be objective and technical
    this.IMAGE_ANALYSIS_SYSTEM_PROMPT = IMAGE_ANALYSIS_SYSTEM_PROMPT;
  }

  // 3. Add a "Getter" to load it only when needed
  private get client(): OpenAI {
    if (!this._client) {
      // Now this runs ONLY when you call analyzeImage()
      // By this time, environment variables are guaranteed to be loaded.
      this._client = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }
    return this._client;
  }

  /**
   * Analyzes a single image and returns a technical description.
   * @param imageUrl - The public URL of the image or a base64 string.
   * @param imageId - Optional ID to track which image this belongs to.
   */
  async analyzeImage(imageUrl: string, imageId: string = "unknown"): Promise<VisionAnalysis> {
    try {
      const response = await this.client.chat.completions.create({
        model: "gpt-4o", // The specialized multimodal model
        messages: [
          {
            role: "system",
            content: this.IMAGE_ANALYSIS_SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Describe the technical details in this image.",
              },
              {
                type: "image_url",
                image_url: {
                  url: imageUrl,
                  detail: "high", // "high" allows the model to see fine cracks/textures
                },
              },
            ],
          },
        ],
        max_tokens: 300, // Keeps the description concise
      });

      const description = response.choices[0]?.message?.content || "No analysis generated.";

      return {
        imageId,
        description,
        timestamp: new Date().toISOString(),
      };

    } catch (error) {
      console.error(`[VisionAgent] Error analyzing image ${imageId}:`, error);
      return {
        imageId,
        description: "Error: Could not analyze image due to an API or network failure.",
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Batch process multiple images in parallel (useful for full reports)
   */
  async analyzeBatch(images: { id: string; url: string }[]): Promise<VisionAnalysis[]> {
    // Limit to 5 images at a time. 
    // If you get 429 errors, lower this to 3.
    const limit = pLimit(5);

    const promises = images.map((img) =>
      // Wrap your call in the limit function
      limit(() => this.analyzeImage(img.url, img.id))
    );

    return Promise.all(promises);
  }
}

// Export a singleton instance for easy import
export const visionAgent = new VisionAgent();