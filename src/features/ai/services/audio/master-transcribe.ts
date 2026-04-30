/**
 * Pass 0 of the capture audio pipeline: full-session master transcription.
 *
 * Uploads the audio file (already in Gemini Files) and asks Gemini for a
 * strict JSON transcript with millisecond timestamps. Output drives both the
 * UI timeline and Pass 1 (Router).
 *
 * System prompt: `skills/capture/master-transcribe-system.md`.
 */
import { GoogleGenerativeAI } from "@google/generative-ai";
import { loadSkill } from "@/features/ai/services/chatbot/skill-loader";
import { logger } from "@/lib/logger";
import {
  GEMINI_CACHED_AUDIO_MODEL,
  type UploadedGeminiFile,
} from "@/src/features/ai/services/audio/gemini-files-client";

export type MasterTranscriptSegment = {
  id: number;
  text: string;
  startMs: number;
  endMs: number;
};

export type MasterTranscriptResult = {
  segments: MasterTranscriptSegment[];
  summaryNote: string;
};

function stripCodeFences(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("```")) {
    return trimmed
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
  }
  return trimmed;
}

function coerceSegments(value: unknown): MasterTranscriptSegment[] {
  if (!Array.isArray(value)) return [];
  const out: MasterTranscriptSegment[] = [];
  let nextId = 0;
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const text = typeof o.text === "string" ? o.text.trim() : "";
    if (!text) continue;
    const startRaw = typeof o.startMs === "number" ? o.startMs : Number(o.startMs);
    const endRaw = typeof o.endMs === "number" ? o.endMs : Number(o.endMs);
    const startMs = Number.isFinite(startRaw) ? Math.max(0, Math.round(startRaw)) : 0;
    const endMs = Number.isFinite(endRaw) ? Math.max(startMs, Math.round(endRaw)) : startMs;
    const idRaw = typeof o.id === "number" ? o.id : Number(o.id);
    const id = Number.isFinite(idRaw) ? Math.max(0, Math.round(idRaw)) : nextId;
    out.push({ id, text, startMs, endMs });
    nextId = id + 1;
  }
  return reindexAndSort(out);
}

function reindexAndSort(segs: MasterTranscriptSegment[]): MasterTranscriptSegment[] {
  return [...segs]
    .sort((a, b) => a.startMs - b.startMs)
    .map((s, i) => ({ ...s, id: i }));
}

/**
 * Run Pass 0. Throws on hard failures (no segments, malformed response). The
 * caller is expected to surface the failure via `persistTranscriptionFailure`.
 */
export async function masterTranscribeAudio(
  apiKey: string,
  uploaded: UploadedGeminiFile,
  options?: { model?: string },
): Promise<MasterTranscriptResult> {
  const model = options?.model ?? GEMINI_CACHED_AUDIO_MODEL;
  const systemPrompt = loadSkill("capture/master-transcribe-system").body.trim();

  const genAI = new GoogleGenerativeAI(apiKey);
  const generative = genAI.getGenerativeModel({
    model,
    systemInstruction: systemPrompt,
  });

  const result = await generative.generateContent({
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
            text:
              "Transcribe the attached audio recording per your system instructions. Return ONLY the JSON object.",
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 8192,
      responseMimeType: "application/json",
    },
  });

  const raw = result.response.text() ?? "";
  if (!raw.trim()) {
    throw new Error("Master transcribe returned empty response");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripCodeFences(raw));
  } catch (err) {
    logger.error("[master-transcribe] JSON parse failed", { err, snippet: raw.slice(0, 400) });
    throw new Error("Master transcribe returned invalid JSON");
  }

  const obj = (parsed && typeof parsed === "object" ? parsed : {}) as Record<string, unknown>;
  const segments = coerceSegments(obj.segments);
  const summaryRaw = obj.summary_note;
  const summaryNote =
    typeof summaryRaw === "string" && summaryRaw.trim().length > 0
      ? summaryRaw.trim().slice(0, 1000)
      : "";

  if (segments.length === 0) {
    throw new Error("Master transcribe produced no segments");
  }

  return { segments, summaryNote };
}
