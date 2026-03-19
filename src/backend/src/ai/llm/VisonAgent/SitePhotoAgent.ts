import { VisionStrategy, SitePhotoResult, VisionRequest } from "../interfaces";
import OpenAI from "openai";
import { GoogleGenerativeAI, GenerativeModel , SchemaType} from "@google/generative-ai";
import { IMAGE_ANALYSIS_SYSTEM_PROMPT } from "../prompts/image/VisionPrompts";
import pLimit from 'p-limit'; // Import the queue manager
import axios from 'axios'; // You'll likely need axios or fetch to get the image buffer for Gemini

// 1. Add this helper at the top of the file (outside the class)
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// We explicitly say: "This agent returns SitePhotoResult"
export class SitePhotoAgent implements VisionStrategy<SitePhotoResult> {
private _openaiClient: OpenAI | undefined;
  private _geminiClient: GoogleGenerativeAI | undefined;

  private IMAGE_ANALYSIS_SYSTEM_PROMPT: string;
  constructor() {
    // This prompt forces the model to be objective and technical
    this.IMAGE_ANALYSIS_SYSTEM_PROMPT = IMAGE_ANALYSIS_SYSTEM_PROMPT;
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

  async analyzeImage(
    imageUrl: string, 
    imageId: string = "unknown", 
    provider: 'openai' | 'gemini' = 'gemini',
    userDescription?: string
  ): Promise<SitePhotoResult> {
    // Retry Settings
    const MAX_RETRIES = 3;
    let attempt = 0;

    while (attempt < MAX_RETRIES) {
      try {
        let description = "";
        let tags = [];
        let severity = "";
        let systemPrompt = this.IMAGE_ANALYSIS_SYSTEM_PROMPT;

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
          // Include user-provided description if available to guide analysis
          let promptText = "Describe the technical details in this image.";
          console.log("User Description in SitePhotoAgent:", userDescription);
          if (userDescription && userDescription.trim()) {
            promptText = `The user has provided the following description for this image: "${userDescription}". Please analyze this image with that context in mind. Describe the technical details, assess any issues or conditions visible, and pay special attention to anything related to the user's description.`;
          }

          // 3. Call API with High Resolution enforcement
          const result = await model.generateContent({
            contents: [{ role: 'user', parts: [imagePart, { text: promptText }] }],
            generationConfig: {
              // media_resolution: "MEDIA_RESOLUTION_HIGH", 
              temperature: 0.2, // Lower temp for factual reading
              maxOutputTokens: 2000,
              topP: 0.95,             // Standard sampling for factual accuracy
              responseMimeType: "application/json", 
              responseSchema: {
                type: SchemaType.OBJECT,
                properties: {
                  description: { 
                    type: SchemaType.STRING,
                    description: "Markdown formatted report section with Visual Evidence and Condition Assessment headers." 
                  },
                  tags: {
                    type: SchemaType.ARRAY,
                    items: { type: SchemaType.STRING }
                  },
                  severity: {
                    type: SchemaType.STRING,
                    // 🔥 PRO MOVE: You can strictly enforce your Enum here!
                    enum: ["Low", "Medium", "High", "Critical", "None"] 
                  }
                },
                required: ["description", "tags", "severity"]
              } as any
            } 
          });

          // 4. Extract the raw text string from the response
          const rawText = result.response.text();

          // 5. Safely parse the JSON string into a JavaScript Object
          try {
            const parsedJson = JSON.parse(rawText);
            
            // Assign the values from the parsed object
            description = parsedJson.description || "No description provided.";
            tags = parsedJson.tags || [];
            severity = parsedJson.severity || "None";
            
         } catch (e) {
            console.error("❌ Failed to parse Gemini JSON:", rawText);
            // Fallback if parsing completely fails
            description = "Error parsing image data.";
            tags = ["Error"];
            severity = "None";
         }
        }

        return {
            imageId,
            timestamp: new Date().toISOString(),
            description: description,
            tags: tags,
            severity: severity as "Low" | "Medium" | "High" | "Critical" | "None"
          };

      } catch (error:any) {
        attempt++;
        // Check if it's a "Retryable" error (503 Service Unavailable or 429 Too Many Requests)
        const isRetryable = error.status === 503 || error.status === 429 || error.message?.includes('Overloaded');

        if (isRetryable && attempt < MAX_RETRIES) {
          const delay = attempt * 500; // 0.5s, 1s, 1.5s — give Gemini time to recover from 503
          console.warn(`[SitePhotoAgent] ⚠️ Attempt ${attempt} failed for image ${imageId} (${error.status || 'error'}). Retrying in ${delay}ms...`);
          await wait(delay);
          continue; // Restart the loop
        }
        console.error(`[SitePhotoAgent] ❌ Final Error analyzing image ${imageId}:`, error);
        return {
          imageId,
          description: `Error: Could not analyze image with ${provider}.`,
          timestamp: new Date().toISOString(),
          tags: [],
          severity:"None"
        };
      }
    }
    return {
      imageId,
      timestamp: new Date().toISOString(),
      description: "Error Timeout",
      tags: [],
      severity: "None"
    };
  }

  async analyzeBatch(
    images: VisionRequest[], 
    concurrencyLimit?: number
  ): Promise<SitePhotoResult[]> {
    // Keep concurrency low (default 3) to avoid "high demand" 503s from Gemini; stagger start to avoid burst
    const limit = pLimit(concurrencyLimit || 3);

    const promises = images.map((img) =>
      // Wrap your call in the limit function
      limit(() => this.analyzeImage(
        img.url, 
        img.id, 
        'gemini',
        img.description // Pass user description from VisionRequest if available
      ))
    );

    return Promise.all(promises);
  }
}
