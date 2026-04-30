/**
 * `capture_sessions.transcript_text` may be:
 * - Legacy: JSON array of `{ text, timestampMs }`.
 * - Current: JSON object `{ segments, summary_note, referenced_images, router_assignments? }`.
 */

/** A single transcript segment as stored in `capture_sessions.transcript_text`. */
export type TranscriptSegmentForDb = {
  text: string;
  /** Milliseconds from session start. */
  timestampMs: number;
  /** Optional end of segment; missing for legacy rows. */
  endMs?: number;
};

/** Result of Pass 1 (Router): which transcript chunks belong to which photo. */
export type RouterAssignmentForDb = {
  projectImageId: string;
  /** Indexes into the `segments` array (NOT segment timestamps). */
  chunkIds: number[];
};

export type ParsedTranscriptFromDb = {
  segments: TranscriptSegmentForDb[];
  summaryNote: string | null;
  referencedImages: string[];
  routerAssignments: RouterAssignmentForDb[];
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
    const endRaw = o.endMs;
    const endMs =
      typeof endRaw === "number" && Number.isFinite(endRaw) && endRaw >= ts
        ? Math.round(endRaw)
        : undefined;
    out.push(endMs !== undefined ? { text, timestampMs: ts, endMs } : { text, timestampMs: ts });
  }
  return out;
}

function normalizeRouterAssignmentsFromDb(arr: unknown[]): RouterAssignmentForDb[] {
  const out: RouterAssignmentForDb[] = [];
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const projectImageId =
      typeof o.projectImageId === "string" ? o.projectImageId.trim() : "";
    if (!projectImageId) continue;
    const chunkIds = Array.isArray(o.chunkIds)
      ? o.chunkIds
          .map((n) => (typeof n === "number" && Number.isFinite(n) ? Math.round(n) : null))
          .filter((n): n is number => n != null && n >= 0)
      : [];
    out.push({ projectImageId, chunkIds });
  }
  return out;
}

export function parseTranscriptTextFromDb(
  transcriptText: string | null | undefined,
): ParsedTranscriptFromDb {
  if (!transcriptText || transcriptText.trim() === "") {
    return { segments: [], summaryNote: null, referencedImages: [], routerAssignments: [] };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(transcriptText);
  } catch {
    return { segments: [], summaryNote: null, referencedImages: [], routerAssignments: [] };
  }
  if (Array.isArray(parsed)) {
    return {
      segments: normalizeSegmentsFromDb(parsed),
      summaryNote: null,
      referencedImages: [],
      routerAssignments: [],
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
    const routerAssignments = Array.isArray(o.router_assignments)
      ? normalizeRouterAssignmentsFromDb(o.router_assignments)
      : [];
    return { segments, summaryNote, referencedImages, routerAssignments };
  }
  return { segments: [], summaryNote: null, referencedImages: [], routerAssignments: [] };
}

export function serializeTranscriptForDb(payload: {
  segments: TranscriptSegmentForDb[];
  summary_note?: string | null;
  referenced_images?: string[] | null;
  router_assignments?: RouterAssignmentForDb[] | null;
}): string {
  return JSON.stringify({
    segments: payload.segments,
    summary_note: payload.summary_note ?? "",
    referenced_images: payload.referenced_images ?? [],
    router_assignments: payload.router_assignments ?? [],
  });
}
