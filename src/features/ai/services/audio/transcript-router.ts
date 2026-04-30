/**
 * Pass 1 of the capture audio pipeline: Router.
 *
 * Takes the master transcript (numbered chunks) + photo metadata (with
 * downscaled thumbnails) and asks Gemini to assign chunks to photos based on
 * spoken context + visual evidence. Output drives Pass 2 (Describer).
 *
 * System prompt: `skills/capture/transcript-router-system.md`
 * User template:  `skills/capture/transcript-router-user.md`
 */
import { GoogleGenerativeAI } from "@google/generative-ai";
import sharp from "sharp";
import { loadSkill } from "@/features/ai/services/chatbot/skill-loader";
import { logger } from "@/lib/logger";
import {
  GEMINI_CACHED_AUDIO_MODEL,
} from "@/src/features/ai/services/audio/gemini-files-client";
import type { MasterTranscriptSegment } from "@/features/ai/services/audio/master-transcribe";

/** Photo descriptor passed into the Router (one per project image). */
export type RouterPhotoInput = {
  projectImageId: string;
  takenAtMs: number;
  thumbBase64: string;
  thumbMimeType: string;
};

/** Final routing decision the Router returns. */
export type RouterAssignment = {
  projectImageId: string;
  chunkIds: number[];
};

export type RouterResult = {
  assignments: RouterAssignment[];
  unassignedChunkIds: number[];
};

/** Default thumbnail target. Keeps tokens manageable when many photos are routed in one call. */
const ROUTER_THUMB_MAX_DIM = 512;
const ROUTER_THUMB_QUALITY = 75;

/**
 * Downscale a project image buffer to a JPEG thumbnail suitable for the Router.
 * Returns base64 (no data URL prefix) and the mime type.
 */
export async function downscalePhotoToThumb(
  imageBuffer: Buffer,
  options?: { maxDim?: number; quality?: number },
): Promise<{ base64: string; mimeType: string }> {
  const maxDim = options?.maxDim ?? ROUTER_THUMB_MAX_DIM;
  const quality = options?.quality ?? ROUTER_THUMB_QUALITY;
  try {
    const out = await sharp(imageBuffer)
      .rotate()
      .resize({ width: maxDim, height: maxDim, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality })
      .toBuffer();
    return { base64: out.toString("base64"), mimeType: "image/jpeg" };
  } catch (err) {
    logger.warn("[transcript-router] thumbnail downscale failed; using full image", { err });
    return { base64: imageBuffer.toString("base64"), mimeType: "image/jpeg" };
  }
}

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

function buildUserMessage(
  segments: MasterTranscriptSegment[],
  photos: RouterPhotoInput[],
): string {
  const template = loadSkill("capture/transcript-router-user").body.trim();
  const transcriptJson = JSON.stringify(
    segments.map((s) => ({
      id: s.id,
      text: s.text,
      startMs: s.startMs,
      endMs: s.endMs,
    })),
  );
  const photosJson = JSON.stringify(
    photos.map((p, i) => ({
      photoIndex: i,
      projectImageId: p.projectImageId,
      takenAtMs: p.takenAtMs,
    })),
  );
  return template
    .replace(/\{\{TRANSCRIPT_CHUNKS_JSON\}\}/g, transcriptJson)
    .replace(/\{\{PHOTOS_JSON\}\}/g, photosJson);
}

function coerceAssignments(
  value: unknown,
  validPhotoIds: Set<string>,
  validChunkIds: Set<number>,
): { assignments: RouterAssignment[]; usedChunkIds: Set<number> } {
  const out: RouterAssignment[] = [];
  const used = new Set<number>();
  if (!Array.isArray(value)) return { assignments: out, usedChunkIds: used };
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const projectImageId =
      typeof o.projectImageId === "string" ? o.projectImageId.trim() : "";
    if (!projectImageId || !validPhotoIds.has(projectImageId)) continue;
    const chunkIds = Array.isArray(o.chunkIds)
      ? o.chunkIds
          .map((n) => (typeof n === "number" ? n : Number(n)))
          .filter((n): n is number => Number.isFinite(n) && validChunkIds.has(Math.round(n)))
          .map((n) => Math.round(n))
      : [];
    const dedup: number[] = [];
    for (const id of chunkIds) {
      if (used.has(id)) continue;
      used.add(id);
      dedup.push(id);
    }
    out.push({ projectImageId, chunkIds: dedup });
  }
  return { assignments: out, usedChunkIds: used };
}

function coerceUnassigned(value: unknown, validChunkIds: Set<number>, used: Set<number>): number[] {
  if (!Array.isArray(value)) return [];
  const out: number[] = [];
  for (const v of value) {
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n)) continue;
    const id = Math.round(n);
    if (!validChunkIds.has(id) || used.has(id)) continue;
    used.add(id);
    out.push(id);
  }
  return out;
}

/**
 * Run Pass 1. Returns assignments aligned 1:1 with the input `photos` (every
 * photo present, possibly with empty chunkIds). Throws on hard failures.
 */
export async function routeTranscriptToPhotos(
  apiKey: string,
  segments: MasterTranscriptSegment[],
  photos: RouterPhotoInput[],
  options?: { model?: string },
): Promise<RouterResult> {
  if (photos.length === 0) {
    return { assignments: [], unassignedChunkIds: segments.map((s) => s.id) };
  }
  if (segments.length === 0) {
    return {
      assignments: photos.map((p) => ({ projectImageId: p.projectImageId, chunkIds: [] })),
      unassignedChunkIds: [],
    };
  }

  const model = options?.model ?? GEMINI_CACHED_AUDIO_MODEL;
  const systemPrompt = loadSkill("capture/transcript-router-system").body.trim();
  const userText = buildUserMessage(segments, photos);

  const genAI = new GoogleGenerativeAI(apiKey);
  const generative = genAI.getGenerativeModel({
    model,
    systemInstruction: systemPrompt,
  });

  const parts: Array<
    | { text: string }
    | { inlineData: { mimeType: string; data: string } }
  > = [];
  for (const photo of photos) {
    parts.push({
      inlineData: {
        mimeType: photo.thumbMimeType,
        data: photo.thumbBase64,
      },
    });
  }
  parts.push({ text: userText });

  const result = await generative.generateContent({
    contents: [{ role: "user", parts }],
    generationConfig: {
      temperature: 0.0,
      maxOutputTokens: 4096,
      responseMimeType: "application/json",
    },
  });

  const raw = result.response.text() ?? "";
  if (!raw.trim()) {
    throw new Error("Router returned empty response");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripCodeFences(raw));
  } catch (err) {
    logger.error("[transcript-router] JSON parse failed", { err, snippet: raw.slice(0, 400) });
    throw new Error("Router returned invalid JSON");
  }

  const obj = (parsed && typeof parsed === "object" ? parsed : {}) as Record<string, unknown>;
  const validPhotoIds = new Set(photos.map((p) => p.projectImageId));
  const validChunkIds = new Set(segments.map((s) => s.id));

  const { assignments, usedChunkIds } = coerceAssignments(
    obj.assignments,
    validPhotoIds,
    validChunkIds,
  );

  const assignedPhotoIds = new Set(assignments.map((a) => a.projectImageId));
  for (const photo of photos) {
    if (!assignedPhotoIds.has(photo.projectImageId)) {
      assignments.push({ projectImageId: photo.projectImageId, chunkIds: [] });
    }
  }
  assignments.sort((a, b) => {
    const ai = photos.findIndex((p) => p.projectImageId === a.projectImageId);
    const bi = photos.findIndex((p) => p.projectImageId === b.projectImageId);
    return ai - bi;
  });

  const explicitUnassigned = coerceUnassigned(
    obj.unassigned_chunk_ids,
    validChunkIds,
    usedChunkIds,
  );
  const unassignedChunkIds = [...explicitUnassigned];
  for (const seg of segments) {
    if (!usedChunkIds.has(seg.id)) {
      unassignedChunkIds.push(seg.id);
      usedChunkIds.add(seg.id);
    }
  }
  unassignedChunkIds.sort((a, b) => a - b);

  return { assignments, unassignedChunkIds };
}
