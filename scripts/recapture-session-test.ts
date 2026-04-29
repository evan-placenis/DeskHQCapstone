/**
 * Prepare a historical capture session so the transcription pipeline (`transcribe-session`)
 * can be re-run: sync `capture_session_images.taken_at_ms` from wall-clock timestamps
 * (default source: **`project_images.created_at`**, Postgres timestamptz / ISO strings).
 * (earliest shot = 0 ms, others offset in ms). Optionally inserts missing session↔photo links
 * for all images under the session's project + folder_name.
 *
 * Prerequisites (unchanged by this script):
 * - Audio exists at `{org}/{project}/temp/{sessionId}/audio.webm` (project-audio bucket)
 * - `capture_sessions` has project_id + folder_name set
 *
 * Env:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage:
 *   npx tsx scripts/recapture-session-test.ts <sessionId> [--apply] [--reset-transcript]
 *
 * Defaults to dry-run: prints computed taken_at_ms and expected audio path only.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Same as capture-ai-pipeline-job.expectedTempAudioPath */
function expectedTempAudioPath(
  organizationId: string,
  projectId: string,
  sessionId: string,
): string {
  return `${organizationId}/${projectId}/temp/${sessionId}/audio.webm`;
}

type ProjectImageRow = {
  id: string;
  created_at: string | null;
};

function parseArgs(argv: string[]): {
  sessionId: string;
  apply: boolean;
  resetTranscript: boolean;
} {
  const rest = argv.slice(2).filter(Boolean);
  const positional = rest.filter((a) => !a.startsWith("--"));
  const flags = new Set(rest.filter((a) => a.startsWith("--")));

  const sessionId = positional[0]?.trim() ?? "";
  if (!sessionId) {
    console.error(
      "Usage: npx tsx scripts/recapture-session-test.ts <sessionId> [--apply] [--reset-transcript]",
    );
    process.exit(1);
  }
  return {
    sessionId,
    apply: flags.has("--apply"),
    resetTranscript: flags.has("--reset-transcript"),
  };
}

function toEpochMs(isoOrNull: string | null): number | null {
  if (!isoOrNull || typeof isoOrNull !== "string") return null;
  const ms = Date.parse(isoOrNull);
  return Number.isFinite(ms) ? ms : null;
}

async function main() {
  const { sessionId, apply, resetTranscript } = parseArgs(process.argv);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const admin = createClient(url, key);

  const { data: session, error: sErr } = await admin
    .from("capture_sessions")
    .select(
      "id, organization_id, project_id, folder_name, created_by, transcript_text, transcription_status",
    )
    .eq("id", sessionId)
    .maybeSingle();

  if (sErr || !session) {
    console.error("capture_sessions not found:", sErr?.message ?? sessionId);
    process.exit(1);
  }

  const organizationId = session.organization_id as string;
  const projectId = session.project_id as string | undefined;
  const folderName = session.folder_name as string;

  if (!projectId?.trim()) {
    console.error("Session has no project_id; finalize the session first.");
    process.exit(1);
  }

  const audioPath = expectedTempAudioPath(organizationId, projectId, sessionId);

  const { data: imageRows, error: imgErr } = await admin
    .from("project_images")
    .select("id, created_at")
    .eq("project_id", projectId)
    .eq("folder_name", folderName)
    .order("created_at", { ascending: true });

  if (imgErr) {
    console.error("project_images query failed:", imgErr.message);
    process.exit(1);
  }

  const images = (imageRows ?? []) as ProjectImageRow[];

  const epochPairs: { projectImageId: string; epochMs: number | null }[] = images.map(
    (img) => ({
      projectImageId: img.id,
      epochMs: toEpochMs(img.created_at),
    }),
  );

  const validEpochs = epochPairs
    .map((p) => p.epochMs)
    .filter((n): n is number => typeof n === "number" && Number.isFinite(n));

  let minEpoch: number | null =
    validEpochs.length > 0 ? Math.min(...validEpochs) : null;

  if (minEpoch == null && images.length > 0) {
    console.warn(
      "[warn] No valid created_at timestamps; assigning taken_at_ms in table order (+1000ms steps).",
    );
  }

  const planned: { projectImageId: string; taken_at_ms: number; note: string }[] = [];

  if (validEpochs.length > 0 && minEpoch !== null) {
    for (const p of epochPairs) {
      const epoch = p.epochMs;
      const taken_ms =
        epoch != null ? Math.max(0, Math.round(epoch - minEpoch)) : 0;
      planned.push({
        projectImageId: p.projectImageId,
        taken_at_ms: taken_ms,
        note:
          epoch != null ? "relative to min(created_at)" : "fallback 0 — missing created_at",
      });
    }
  } else {
    images.forEach((img, idx) => {
      planned.push({
        projectImageId: img.id,
        taken_at_ms: idx * 1000,
        note: "sequential index (no timestamps)",
      });
    });
  }

  const { data: existingLinks, error: linkErr } = await admin
    .from("capture_session_images")
    .select("project_image_id, taken_at_ms")
    .eq("capture_session_id", sessionId);

  if (linkErr) {
    console.error("capture_session_images query failed:", linkErr.message);
    process.exit(1);
  }

  const linkMap = new Map(
    ((existingLinks ?? []) as { project_image_id: string }[]).map((r) => [
      r.project_image_id,
      r as { project_image_id: string; taken_at_ms?: number },
    ]),
  );

  console.log("");
  console.log("=== Capture session rehearsal / backfill ===");
  console.log("session_id:", sessionId);
  console.log("project_id:", projectId);
  console.log("folder_name:", folderName);
  console.log(
    "baseline (earliest created_at epoch ms):",
    minEpoch != null ? String(minEpoch) : "(none — using sequential)",
  );
  console.log("audio object key (must exist in bucket `project-audio`):");
  console.log(" ", audioPath);
  console.log("");
  console.log(transcriptSnippet(session.transcript_text));
  console.log("Planned rows (capture_session_images):");
  console.table(
    planned.map((p) => ({
      project_image_id: p.projectImageId.slice(0, 8) + "…",
      taken_at_ms: p.taken_at_ms,
      action: linkMap.has(p.projectImageId) ? "update" : "insert",
      note: p.note,
    })),
  );

  const missingPhotos = planned.filter((p) => !linkMap.has(p.projectImageId));
  const extraLinks = [...linkMap.keys()].filter(
    (id) => !planned.some((p) => p.projectImageId === id),
  );
  if (missingPhotos.length > 0) {
    console.log(`Will INSERT ${missingPhotos.length} missing link(s).`);
  }
  if (extraLinks.length > 0) {
    console.log(
      "[note] Existing session links not in folder query (left unchanged):",
      extraLinks.length,
    );
  }

  const triggerPayload = {
    sessionId,
    storagePath: audioPath,
  };

  console.log("");
  console.log("Trigger.dev payload (paste into test run `transcribe-session`):");
  console.log(JSON.stringify(triggerPayload, null, 2));
  console.log("");
  console.log(
    "If transcript_text is already set, `/api/capture-sessions/transcribe` skips queue — use [--reset-transcript] with [--apply].",
  );

  if (!apply) {
    console.log("");
    console.log("(dry-run) Pass --apply to UPSERT capture_session_images and optional reset.");
    process.exit(0);
  }

  let ok = await applyPlans(admin, sessionId, planned, linkMap);

  if (resetTranscript) {
    const { error: uErr } = await admin
      .from("capture_sessions")
      .update({
        transcript_text: null,
        transcription_error: null,
        transcription_status: "idle",
      })
      .eq("id", sessionId);
    if (uErr) {
      console.error("Failed to reset transcript columns:", uErr.message);
      ok = false;
    } else {
      console.log("Reset transcript_text / error; transcription_status=idled.");
    }
  }

  process.exit(ok ? 0 : 1);
}

function transcriptSnippet(text: unknown): string {
  if (text == null || String(text).trim() === "") {
    return "transcript_text: (empty)";
  }
  const raw = String(text);
  return `transcript_text: ${raw.length} chars (non-empty — API transcribe route may refuse to queue)`;
}

async function applyPlans(
  admin: SupabaseClient,
  sessionId: string,
  planned: { projectImageId: string; taken_at_ms: number }[],
  linkMap: Map<string, { project_image_id: string }>,
): Promise<boolean> {
  let allOk = true;

  for (const row of planned) {
    const exists = linkMap.has(row.projectImageId);

    if (exists) {
      const { error } = await admin
        .from("capture_session_images")
        .update({ taken_at_ms: row.taken_at_ms })
        .eq("capture_session_id", sessionId)
        .eq("project_image_id", row.projectImageId);
      if (error) {
        console.error(`Update failed ${row.projectImageId}:`, error.message);
        allOk = false;
      } else {
        console.log(`Updated taken_at_ms=${row.taken_at_ms} for`, row.projectImageId);
      }
    } else {
      const { error } = await admin.from("capture_session_images").insert({
        capture_session_id: sessionId,
        project_image_id: row.projectImageId,
        taken_at_ms: row.taken_at_ms,
      });
      if (error) {
        console.error(`Insert failed ${row.projectImageId}:`, error.message);
        allOk = false;
      } else {
        console.log(`Inserted link taken_at_ms=${row.taken_at_ms} for`, row.projectImageId);
      }
    }
  }

  return allOk;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
