import { readFileSync } from "fs";
import path from "path";
import { SpecAnalysisResult, VisionStrategy, VisionRequest } from "./interfaces";
import { generateText } from "ai";
import { ModelStrategy } from "../models/model-strategy";
import pLimit from "p-limit";
import type { AiSdkChatProvider } from "@/lib/ai-providers";
import { DEFAULT_AI_SDK_CHAT_PROVIDER } from "@/lib/ai-providers";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class SpecAgent implements VisionStrategy<SpecAnalysisResult> {
  private SPEC_IMAGE_ANALYSIS_SYSTEM_PROMPT: string;

  constructor() {
    this.SPEC_IMAGE_ANALYSIS_SYSTEM_PROMPT = readFileSync(
      path.join(process.cwd(), "skills", "spec-drawing-analysis.md"),
      "utf-8"
    );
  }

  /**
   * Analyzes a single image and returns a technical description.
   * @param imageUrl - The public URL of the image or a base64 string.
   * @param imageId - Optional ID to track which image this belongs to.
   */
  async analyzeImage(
    imageUrl: string,
    imageId: string = "unknown",
    provider: AiSdkChatProvider = DEFAULT_AI_SDK_CHAT_PROVIDER
  ): Promise<SpecAnalysisResult> {
    const MAX_RETRIES = 3;
    let attempt = 0;

    while (attempt < MAX_RETRIES) {
      try {
        const model = ModelStrategy.getModel(provider);

        const { text } = await generateText({
          model,
          system: this.SPEC_IMAGE_ANALYSIS_SYSTEM_PROMPT,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: "Describe the technical details in this image." },
                { type: "image", image: imageUrl },
              ],
            },
          ],
          maxOutputTokens: 2000,
          temperature: 0.1,
        });

        return {
          imageId,
          description: text || "No analysis generated.",
          timestamp: new Date().toISOString(),
        };
      } catch (error: unknown) {
        attempt++;
        const err = error as { status?: number; message?: string };
        const isRetryable =
          err.status === 503 ||
          err.status === 429 ||
          err.message?.includes("Overloaded");

        if (isRetryable && attempt < MAX_RETRIES) {
          const delay = attempt * 500;
          console.warn(
            `[SpecAgent] ⚠️ Attempt ${attempt} failed for image ${imageId} (${err.status ?? "error"}). Retrying in ${delay}ms...`
          );
          await wait(delay);
          continue;
        }
        console.error(
          `[SpecAgent] ❌ Final Error analyzing image ${imageId}:`,
          error
        );
        return {
          imageId,
          description: `Error: Could not analyze image with ${provider}.`,
          timestamp: new Date().toISOString(),
        };
      }
    }

    return {
      imageId,
      description: "Error: Timeout",
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Batch process multiple images in parallel (useful for full reports)
   */
  async analyzeBatch(
    images: VisionRequest[],
    concurrencyLimit?: number,
    provider: AiSdkChatProvider = DEFAULT_AI_SDK_CHAT_PROVIDER
  ): Promise<SpecAnalysisResult[]> {
    const limit = pLimit(concurrencyLimit ?? 3);

    const promises = images.map((img) =>
      limit(() => this.analyzeImage(img.url, img.id, provider))
    );

    return Promise.all(promises);
  }
}
