/**
 * Re-run the capture transcription pipeline (`transcribe-session`) using data already in Supabase.
 *
 * - Ensures **every gallery image** in `project_images` for this session’s `folder_name`
 *   has a **capture_session_images** row whose **taken_at_ms** comes **only**
 *   from **`capture_session_images`** (true session-timeline offsets from capture upload).
 *   Refreshes `taken_at_ms` via UPDATE so bogus values rewritten earlier are overwritten
 *   with the authoritative row value (repair idempotent writes).
 * - No invented timestamps (`created_at` is not used).
 * - Errors if folder images lack a session link (`taken_at_ms` unknown).
 *
 * Prerequisites: Audio at `{org}/{project}/temp/{sessionId}/audio.webm`, valid session row.
 *
 *   npm run recapture-test -- <sessionId>
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TRIGGER_SECRET_KEY
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { tasks } from "@trigger.dev/sdk/v3";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

function expectedTempAudioPath(
  organizationId: string,
  projectId: string,
  sessionId: string,
): string {
  return `${organizationId}/${projectId}/temp/${sessionId}/audio.webm`;
}

function normalizeTakenMs(raw: unknown): number {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return Math.max(0, Math.round(raw));
  }
  return 0;
}

/**
 * Re-apply capture_session_images.taken_at_ms from DB for rows that join session + folder.
 * Fails fast if folder has images missing from CSI.
 */
async function syncSessionImages(
  admin: SupabaseClient,
  sessionId: string,
  projectId: string,
  folderName: string,
): Promise<number> {
  const { data: folderRows, error: folderErr } = await admin
    .from("project_images")
    .select("id")
    .eq("project_id", projectId)
    .eq("folder_name", folderName);

  if (folderErr) throw new Error(`project_images: ${folderErr.message}`);

  const folderIds = new Set(
    ((folderRows ?? []) as { id: string }[]).map((r) => r.id),
  );

  if (folderIds.size === 0) {
    console.warn(
      "[warn] No project_images in this folder — pipeline will transcript audio only.",
    );
    return 0;
  }

  const { data: linksRaw, error: linkErr } = await admin
    .from("capture_session_images")
    .select("project_image_id, taken_at_ms")
    .eq("capture_session_id", sessionId);

  if (linkErr) throw new Error(`capture_session_images: ${linkErr.message}`);

  const allLinks =
    (linksRaw ?? []) as { project_image_id: string; taken_at_ms?: number | null }[];

  const extraLinks = allLinks.filter((l) => !folderIds.has(l.project_image_id));
  if (extraLinks.length > 0) {
    console.warn(
      `[warn] ${extraLinks.length} capture_session_images row(s) point to photos outside this folder (ignored).`,
    );
  }

  const missingInSession: string[] = [];
  for (const id of folderIds) {
    if (!allLinks.some((l) => l.project_image_id === id)) missingInSession.push(id);
  }
  if (missingInSession.length > 0) {
    throw new Error(
      `Folder has ${missingInSession.length} project_image(s) with no capture_session_images row:\n` +
        missingInSession.join("\n") +
        "\nAdd links via normal capture upload; this script cannot invent taken_at_ms.",
    );
  }

  const planned = allLinks
    .filter((l) => folderIds.has(l.project_image_id))
    .map((l) => ({
      projectImageId: l.project_image_id,
      taken_at_ms: normalizeTakenMs(l.taken_at_ms),
    }))
    .sort(
      (a, b) =>
        a.taken_at_ms - b.taken_at_ms ||
        a.projectImageId.localeCompare(b.projectImageId),
    );

  for (const row of planned) {
    const { error } = await admin
      .from("capture_session_images")
      .update({ taken_at_ms: row.taken_at_ms })
      .eq("capture_session_id", sessionId)
      .eq("project_image_id", row.projectImageId);

    if (error) throw new Error(`update link ${row.projectImageId}: ${error.message}`);
  }

  console.log(
    `[recapture-test] Verified ${planned.length} photo timeline(s) from capture_session_images (ordered by taken_at_ms).`,
  );

  return planned.length;
}

async function main() {
  const sessionId = process.argv.slice(2).filter((a) => !a.startsWith("-"))[0]?.trim();

  if (!sessionId) {
    console.error("Usage: npm run recapture-test -- <captureSessionUuid>");
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const triggerSecret =
    process.env.TRIGGER_SECRET_KEY ?? process.env.TRIGGER_API_KEY ?? "";

  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }
  if (!triggerSecret.trim()) {
    console.error(
      "Missing TRIGGER_SECRET_KEY (same secret as Trigger.dev CLI / prod). Needed to enqueue transcribe-session.",
    );
    process.exit(1);
  }

  const admin = createClient(url, key);

  const { data: session, error: sErr } = await admin
    .from("capture_sessions")
    .select("id, organization_id, project_id, folder_name")
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
    console.error("Session has no project_id.");
    process.exit(1);
  }

  const storagePath = expectedTempAudioPath(organizationId, projectId, sessionId);

  const plannedCount = await syncSessionImages(admin, sessionId, projectId, folderName);

  const { error: prepErr } = await admin
    .from("capture_sessions")
    .update({
      transcript_text: null,
      transcription_error: null,
      transcription_status: "queued",
    })
    .eq("id", sessionId);

  if (prepErr) {
    console.error("Failed to prepare capture_sessions row:", prepErr.message);
    process.exit(1);
  }

  const handle = await tasks.trigger("transcribe-session", {
    sessionId,
    storagePath,
  });

  console.log("");
  console.log("Capture pipeline queued.");
  console.log("session_id:", sessionId);
  console.log("project_id:", projectId);
  console.log("folder_name:", folderName);
  console.log("images_verified:", plannedCount);
  console.log("storagePath:", storagePath);
  console.log("Trigger run ID:", handle.id);
  console.log("");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
