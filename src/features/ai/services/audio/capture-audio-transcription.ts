/**
 * Per-photo multimodal probes: cached session audio + one gallery image + time window.
 *
 * Prompts: `skills/capture/photo-probe-system.md`, `skills/capture/photo-probe-user.md` — see `skills/capture/prompts.md`.
 */
import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  GEMINI_CACHED_AUDIO_MODEL,
  type CachedContentApiResponse,
  type UploadedGeminiFile,
} from "@/features/ai/services/audio/gemini-files-cache";
import { loadSkill } from "@/features/ai/services/chatbot/skill-loader";

/** Image bytes as base64 for Gemini `inlineData` (same bucket as project gallery). */
export type PhotoProbeImageInput = {
  mimeType: string;
  base64: string;
};

/** Non-overlapping audio slice for this photo (seconds from session start). */
export type PhotoProbeAudioWindow = {
  startSec: number;
  endSec: number;
};

function buildPhotoProbeUserMessage(
  projectImageId: string,
  startSec: number,
  endSec: number,
): string {
  const raw = loadSkill("capture/photo-probe-user").body.trim();
  return raw
    .replace(/\{\{PROJECT_IMAGE_ID\}\}/g, projectImageId)
    .replace(/\{\{START_SEC\}\}/g, startSec.toFixed(2))
    .replace(/\{\{END_SEC\}\}/g, endSec.toFixed(2));
}

/**
 * Per-photo description: multimodal (image + cached session audio) with a dynamic [startSec, endSec] window.
 */
export async function describePhotoFromCachedAudio(
  cachedContent: CachedContentApiResponse,
  projectImageId: string,
  window: PhotoProbeAudioWindow,
  image: PhotoProbeImageInput,
): Promise<string> {
  const apiKey = process.env.GOOGLE_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("GOOGLE_API_KEY is not set");
  }

  const startSec = Math.max(0, window.startSec);
  const endSec = Math.max(startSec, window.endSec);

  const systemPrompt = loadSkill("capture/photo-probe-system").body.trim();
  const userText = buildPhotoProbeUserMessage(projectImageId, startSec, endSec);

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModelFromCachedContent(
    cachedContent as unknown as Parameters<
      GoogleGenerativeAI["getGenerativeModelFromCachedContent"]
    >[0],
    {
      systemInstruction: systemPrompt,
    },
  );

  const result = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType: image.mimeType,
              data: image.base64,
            },
          },
          { text: userText },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.35,
      maxOutputTokens: 512,
    },
  });

  return (result.response.text() ?? "").trim();
}

/**
 * Same probe as {@link describePhotoFromCachedAudio} but sends session audio via `fileData` on each request
 * (no context cache). Use when `createContextCacheFromFile` fails but the file is still ACTIVE in Gemini Files.
 */
export async function describePhotoFromSessionAudioFile(
  uploaded: UploadedGeminiFile,
  projectImageId: string,
  window: PhotoProbeAudioWindow,
  image: PhotoProbeImageInput,
): Promise<string> {
  const apiKey = process.env.GOOGLE_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("GOOGLE_API_KEY is not set");
  }

  const startSec = Math.max(0, window.startSec);
  const endSec = Math.max(startSec, window.endSec);

  const systemPrompt = loadSkill("capture/photo-probe-system").body.trim();
  const userText = buildPhotoProbeUserMessage(projectImageId, startSec, endSec);

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: GEMINI_CACHED_AUDIO_MODEL,
    systemInstruction: systemPrompt,
  });

  const result = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: [
          {
            fileData: {
              fileUri: uploaded.uri,
              mimeType: uploaded.mimeType,
            },
          },
          {
            inlineData: {
              mimeType: image.mimeType,
              data: image.base64,
            },
          },
          { text: userText },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.35,
      maxOutputTokens: 512,
    },
  });

  return (result.response.text() ?? "").trim();
}
