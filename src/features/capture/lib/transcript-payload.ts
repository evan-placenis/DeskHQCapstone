/**
 * `capture_sessions.transcript_text` may be:
 * - Legacy: JSON array of `{ text, timestampMs }`
 * - Current: JSON object `{ segments, summary_note, referenced_images }`
 */

export type TranscriptSegmentForDb = { text: string; timestampMs: number };

export type ParsedTranscriptFromDb = {
  segments: TranscriptSegmentForDb[];
  summaryNote: string | null;
  referencedImages: string[];
};

function normalizeSegmentsFromDb(arr: unknown[]): TranscriptSegmentForDb[] {
  const out: TranscriptSegmentForDb[] = [];
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const text = typeof o.text === "string" ? o.text.trim() : "";
    if (text.length === 0) continue;
    const ts =
      typeof o.timestampMs === "number" && Number.isFinite(o.timestampMs)
        ? Math.max(0, Math.round(o.timestampMs))
        : 0;
    out.push({ text, timestampMs: ts });
  }
  return out;
}

export function parseTranscriptTextFromDb(
  transcriptText: string | null | undefined,
): ParsedTranscriptFromDb {
  if (!transcriptText || transcriptText.trim() === "") {
    return { segments: [], summaryNote: null, referencedImages: [] };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(transcriptText);
  } catch {
    return { segments: [], summaryNote: null, referencedImages: [] };
  }
  if (Array.isArray(parsed)) {
    return {
      segments: normalizeSegmentsFromDb(parsed),
      summaryNote: null,
      referencedImages: [],
    };
  }
  if (parsed && typeof parsed === "object") {
    const o = parsed as Record<string, unknown>;
    const segments = Array.isArray(o.segments)
      ? normalizeSegmentsFromDb(o.segments)
      : [];
    const rawSummary = o.summary_note;
    const summaryNote =
      typeof rawSummary === "string" && rawSummary.trim().length > 0
        ? rawSummary.trim()
        : null;
    const referencedImages = Array.isArray(o.referenced_images)
      ? o.referenced_images
          .map((id) => (id == null ? "" : String(id).trim()))
          .filter((s) => s.length > 0)
      : [];
    return { segments, summaryNote, referencedImages };
  }
  return { segments: [], summaryNote: null, referencedImages: [] };
}

export function serializeTranscriptForDb(payload: {
  segments: TranscriptSegmentForDb[];
  summary_note?: string | null;
  referenced_images?: string[] | null;
}): string {
  return JSON.stringify({
    segments: payload.segments,
    summary_note: payload.summary_note ?? "",
    referenced_images: payload.referenced_images ?? [],
  });
}
