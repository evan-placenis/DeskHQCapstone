/**
 * Capture-session audio: Gemini Files API + context cache only (Trigger.dev job).
 * Prompt: `skills/capture-audio-transcription.md` for the master JSON transcript.
 */
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { CachedContentApiResponse } from "@/features/ai/services/audio/gemini-files-cache";
import { loadSkill } from "@/features/ai/services/chatbot/skill-loader";
import { logger } from "@/lib/logger";

export type CaptureTranscriptSegment = { text: string; timestampMs: number };

export type CaptureTranscribeAudioResult = {
  segments: CaptureTranscriptSegment[];
  durationSeconds: number | null;
  summary_note: string;
  referenced_images: string[];
};

function parseSttJsonResponse(raw: string): CaptureTranscribeAudioResult {
  const emptyMeta = (): Pick<CaptureTranscribeAudioResult, "summary_note" | "referenced_images"> => ({
    summary_note: "",
    referenced_images: [],
  });

  let parsed: {
    segments?: Array<{ start?: number; end?: number; text?: string }>;
    summary_note?: string;
    referenced_images?: unknown[];
  };
  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    logger.warn("[CaptureAudio] STT JSON parse failed, falling back to plain text:", raw.slice(0, 200));
    const fallbackText = raw.replace(/^\s*[\[{][\s\S]*[\]}]\s*$/, "").trim() || raw;
    const segments = fallbackText
      ? [{ text: fallbackText, timestampMs: 0 }]
      : [];
    return { segments, durationSeconds: null, ...emptyMeta() };
  }

  const summary_note =
    typeof parsed.summary_note === "string" ? parsed.summary_note.trim() : "";
  const referenced_images = Array.isArray(parsed.referenced_images)
    ? parsed.referenced_images
        .map((id) => (id == null ? "" : String(id).trim()))
        .filter((s) => s.length > 0)
    : [];

  const segs = parsed.segments;
  if (!Array.isArray(segs)) {
    return { segments: [], durationSeconds: null, summary_note, referenced_images };
  }

  let maxEndSec = 0;
  const segments = segs
    .map((s) => {
      const text = typeof s.text === "string" ? s.text.trim() : "";
      const startSec = typeof s.start === "number" && Number.isFinite(s.start) ? s.start : 0;
      const endSec = typeof s.end === "number" && Number.isFinite(s.end) ? s.end : startSec;
      maxEndSec = Math.max(maxEndSec, endSec);
      const timestampMs = Math.round(Math.max(0, startSec) * 1000);
      return { text, timestampMs };
    })
    .filter((s) => s.text.length > 0);

  const durationSeconds =
    maxEndSec > 0
      ? Math.max(1, Math.ceil(maxEndSec))
      : segments.length > 0
        ? Math.max(1, Math.ceil((segments[segments.length - 1].timestampMs / 1000) + 2))
        : null;

  return { segments, durationSeconds, summary_note, referenced_images };
}

export type TranscribeCaptureSessionAudioOptions = {
  /** Project image UUIDs for this capture (in order). Model must use only these in `referenced_images`. */
  projectImageIds?: string[];
};

/**
 * Master transcript: JSON segments + summary + referenced_images (same cache as upload).
 */
export async function transcribeCaptureSessionAudio(
  cachedContent: CachedContentApiResponse,
  options?: TranscribeCaptureSessionAudioOptions,
): Promise<CaptureTranscribeAudioResult> {
  const apiKey = process.env.GOOGLE_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("GOOGLE_API_KEY is not set");
  }

  const skill = loadSkill("capture-audio-transcription");
  const systemPrompt = skill.body.trim();

  const ids =
    options?.projectImageIds?.filter((id) => typeof id === "string" && id.trim().length > 0) ?? [];
  const contextBlock =
    ids.length > 0
      ? `\n\nProject image UUIDs for this capture (use only these IDs in referenced_images, in order of relevance):\n${ids.map((id) => `- ${id}`).join("\n")}`
      : "";

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModelFromCachedContent(
    cachedContent as unknown as Parameters<
      GoogleGenerativeAI["getGenerativeModelFromCachedContent"]
    >[0],
    {
      systemInstruction: systemPrompt,
    },
  );

  const userText = `Output only the JSON object described in your instructions.${contextBlock}`;
  const t0 = Date.now();

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: userText }] }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 8192,
      responseMimeType: "application/json",
    },
  });

  const raw = (result.response.text() ?? "").trim();
  const parsed = parseSttJsonResponse(raw);
  const durationMs = Date.now() - t0;
  logger.info("[CaptureAudio] master transcript (cached)", {
    durationMs,
    cacheName: cachedContent.name,
    segmentCount: parsed.segments.length,
    durationSeconds: parsed.durationSeconds,
    summaryChars: parsed.summary_note.length,
    referencedImages: parsed.referenced_images.length,
  });
  return parsed;
}

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

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModelFromCachedContent(
    cachedContent as unknown as Parameters<
      GoogleGenerativeAI["getGenerativeModelFromCachedContent"]
    >[0],
    {
      systemInstruction:
        "You are a professional field inspector. You see one photo from the site and hear this session's recording. Cross-check what is visible in the image with what is said in the assigned audio time range. Reply with plain English only. No markdown, no bullet list labels, no image id prefix.",
    },
  );

  const userText = `Photo id (for your context only; do not repeat it in the answer): ${projectImageId}.\n\nLook at the image. Listen to the cached audio from ${startSec.toFixed(2)} seconds through ${endSec.toFixed(2)} seconds (inclusive of that segment). Write a specific, professional description of what is shown in the image, grounded in both the visual evidence and the narration in that time window. If the audio does not mention this subject, say what you see visually and note only relevant audio. Write 2–5 short sentences. Output only the description.`;

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
