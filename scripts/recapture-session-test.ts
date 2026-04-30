/**
 * Re-run the capture transcription pipeline (`transcribe-session`) using data already in Supabase.
 *
 * Read-only check on photo links: every `project_images` row in this session’s `folder_name`
 * must have a `capture_session_images` row. **`taken_at_ms` is never modified** here—only
 * read for logging; it is owned by the capture upload flow.
 *
 * - Clears transcript / error, sets transcription_status=queued, triggers `transcribe-session`.
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

/**
 * Verifies folder images are linked in `capture_session_images`. Does not write `taken_at_ms`.
 */
async function verifyCaptureSessionImageLinks(
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
        "\nAdd links via normal capture upload.",
    );
  }

  const inFolder = allLinks.filter((l) => folderIds.has(l.project_image_id));
  const sorted = [...inFolder].sort(
    (a, b) =>
      Number(a.taken_at_ms ?? 0) - Number(b.taken_at_ms ?? 0) ||
      a.project_image_id.localeCompare(b.project_image_id),
  );

  console.log(
    `[recapture-test] Read-only check: ${sorted.length} photo link(s); taken_at_ms (ms) sample: ` +
      sorted
        .slice(0, 5)
        .map((r) => `${String(r.project_image_id).slice(0, 8)}…=${r.taken_at_ms ?? "null"}`)
        .join(", ") +
      (sorted.length > 5 ? ", …" : ""),
  );

  return sorted.length;
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

  const photoLinkCount = await verifyCaptureSessionImageLinks(
    admin,
    sessionId,
    projectId,
    folderName,
  );

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
  console.log("images_linked_verified:", photoLinkCount);
  console.log("storagePath:", storagePath);
  console.log("Trigger run ID:", handle.id);
  console.log("");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
