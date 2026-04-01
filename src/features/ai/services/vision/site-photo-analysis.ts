import { readFileSync } from "fs";
import path from "path";
import { VisionStrategy, SitePhotoResult, VisionRequest } from "./interfaces";
import { generateObject } from "ai";
import { z } from "zod";
import { ModelStrategy } from "../models/model-strategy";
import pLimit from "p-limit";
import type { AiSdkChatProvider } from "@/lib/ai-providers";
import { DEFAULT_AI_SDK_CHAT_PROVIDER } from "@/lib/ai-providers";
import { logger } from "@/lib/logger";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const sitePhotoSchema = z.object({
  reasoning: z.string().describe("Your step-by-step spatial, physical, and safety analysis. Explain your logic before providing the final description."),
  description: z.string().describe("The final, polished Markdown summary for the report."),
  tags: z.array(z.string()),
  severity: z.enum(["Low", "Medium", "High", "Critical", "None"]),
});

export class SitePhotoAgent implements VisionStrategy<SitePhotoResult> {
  private IMAGE_ANALYSIS_SYSTEM_PROMPT: string;

  constructor() {
    this.IMAGE_ANALYSIS_SYSTEM_PROMPT = readFileSync(
      path.join(process.cwd(), "skills", "site-photo-analysis.md"),
      "utf-8"
    );
  }

  async analyzeImage(
    imageUrl: string,
    imageId: string = "unknown",
    provider: AiSdkChatProvider = DEFAULT_AI_SDK_CHAT_PROVIDER,
    userDescription?: string
  ): Promise<SitePhotoResult> {
    const MAX_RETRIES = 3;
    let attempt = 0;

    while (attempt < MAX_RETRIES) {
      try {
        let promptText =
          "Describe the technical details in this image.";
        if (userDescription?.trim()) {
          promptText = `The user has provided the following description for this image: "${userDescription}". Please analyze this image with that context in mind. Describe the technical details, assess any issues or conditions visible, and pay special attention to anything related to the user's description.`;
        }

        const model = ModelStrategy.getModel(provider);

        const { object } = await generateObject({
          model,
          schema: sitePhotoSchema,
          system: this.IMAGE_ANALYSIS_SYSTEM_PROMPT,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: promptText },
                { type: "image", image: new URL(imageUrl) },
              ],
            },
          ],
          maxOutputTokens: 2000,
          temperature: 0.2,
        });

        return {
          imageId,
          timestamp: new Date().toISOString(),
          description: object.description || "No description provided.",
          reasoning: object.reasoning,
          tags: object.tags || [],
          severity: object.severity,
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
          logger.warn(
            `[SitePhotoAgent] ⚠️ Attempt ${attempt} failed for image ${imageId} (${err.status ?? "error"}). Retrying in ${delay}ms...`
          );
          await wait(delay);
          continue;
        }
        logger.error(
          `[SitePhotoAgent] ❌ Final Error analyzing image ${imageId}:`,
          error
        );
        return {
          imageId,
          description: `Error: Could not analyze image with ${provider}.`,
          timestamp: new Date().toISOString(),
          tags: [],
          severity: "None",
        };
      }
    }

    return {
      imageId,
      timestamp: new Date().toISOString(),
      description: "Error Timeout",
      tags: [],
      severity: "None",
    };
  }

  async analyzeBatch(
    images: VisionRequest[],
    concurrencyLimit?: number,
    provider: AiSdkChatProvider = DEFAULT_AI_SDK_CHAT_PROVIDER
  ): Promise<SitePhotoResult[]> {
    const limit = pLimit(concurrencyLimit ?? 3);

    const promises = images.map((img) =>
      limit(() =>
        this.analyzeImage(img.url, img.id, provider, img.description)
      )
    );

    return Promise.all(promises);
  }
}
