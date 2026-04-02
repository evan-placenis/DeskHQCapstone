/**
 * Batch transcription for capture-session audio using the same Gemini Flash-Lite model
 * as {@link ModelStrategy.getModel} (`gemini-lite`). Prompt: `skills/capture-audio-transcription.md`.
 * Pattern aligns with `../vision/spec-drawing-analysis.ts` (generateText + ModelStrategy).
 */
import { generateText } from "ai";
import { loadSkill } from "@/features/ai/services/chatbot/skill-loader";
import { logger } from "@/lib/logger";
import { ModelStrategy } from "@/features/ai/services/models/model-strategy";

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
 * Transcribes one recording to timestamped segments (JSON contract in the skill file).
 */
export async function transcribeCaptureSessionAudio(
  audioBuffer: Buffer,
  mimeType: string,
  options?: TranscribeCaptureSessionAudioOptions,
): Promise<CaptureTranscribeAudioResult> {
  const skill = loadSkill("capture-audio-transcription");
  const systemPrompt = skill.body.trim();
  const model = ModelStrategy.getModel("gemini-lite");

  const ids = options?.projectImageIds?.filter((id) => typeof id === "string" && id.trim().length > 0) ?? [];
  const contextBlock =
    ids.length > 0
      ? `\n\nProject image UUIDs for this capture (use only these IDs in referenced_images, in order of relevance):\n${ids.map((id) => `- ${id}`).join("\n")}`
      : "";

  const t0 = Date.now();
  const { text } = await generateText({
    model,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "file",
            data: new Uint8Array(audioBuffer),
            mediaType: mimeType || "audio/webm",
          },
          {
            type: "text",
            text: `Output only the JSON object described in your instructions.${contextBlock}`,
          },
        ],
      },
    ],
    temperature: 0.2,
    maxOutputTokens: 8192,
    providerOptions: {
      google: {
        responseMimeType: "application/json",
      },
    },
  });

  const raw = (text ?? "").trim();
  const parsed = parseSttJsonResponse(raw);
  const durationMs = Date.now() - t0;
  logger.info("[CaptureAudio] Gemini generateText + parse", {
    durationMs,
    inputBytes: audioBuffer.length,
    mimeType: mimeType || "audio/webm",
    segmentCount: parsed.segments.length,
    durationSeconds: parsed.durationSeconds,
    summaryChars: parsed.summary_note.length,
    referencedImages: parsed.referenced_images.length,
  });
  return parsed;
}
