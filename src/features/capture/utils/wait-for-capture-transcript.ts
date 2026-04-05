import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Resolves when `capture_sessions.transcript_text` is non-empty (Realtime + polling fallback).
 */
export async function waitForCaptureTranscript(
  supabase: SupabaseClient,
  sessionId: string,
  options?: { timeoutMs?: number },
): Promise<{ transcriptText: string; durationSec: number | null }> {
  const timeoutMs = options?.timeoutMs ?? 45 * 60 * 1000;

  const { data: existing } = await supabase
    .from("capture_sessions")
    .select("transcript_text, audio_duration_seconds")
    .eq("id", sessionId)
    .maybeSingle();

  if (
    existing?.transcript_text &&
    typeof existing.transcript_text === "string" &&
    existing.transcript_text.length > 0
  ) {
    return {
      transcriptText: existing.transcript_text,
      durationSec:
        typeof existing.audio_duration_seconds === "number" ? existing.audio_duration_seconds : null,
    };
  }

  return new Promise((resolve, reject) => {
    let settled = false;

    const poll = setInterval(() => {
      void supabase
        .from("capture_sessions")
        .select("transcript_text, audio_duration_seconds")
        .eq("id", sessionId)
        .maybeSingle()
        .then(({ data }) => {
          if (
            data?.transcript_text &&
            typeof data.transcript_text === "string" &&
            data.transcript_text.length > 0
          ) {
            finishOk(data.transcript_text, data.audio_duration_seconds ?? null);
          }
        });
    }, 5000);

    const channel = supabase
      .channel(`capture-transcript-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "capture_sessions",
          filter: `id=eq.${sessionId}`,
        },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          const tt = row.transcript_text;
          if (typeof tt === "string" && tt.length > 0) {
            finishOk(
              tt,
              typeof row.audio_duration_seconds === "number" ? row.audio_duration_seconds : null,
            );
          }
        },
      )
      .subscribe();

    const timeout = setTimeout(() => {
      finishErr(
        new Error(
          "Transcription is taking longer than expected. You can close the app and return later—processing continues in the background.",
        ),
      );
    }, timeoutMs);

    function cleanup() {
      clearInterval(poll);
      clearTimeout(timeout);
      void supabase.removeChannel(channel);
    }

    function finishOk(transcriptText: string, audioDurationSeconds: number | null) {
      if (settled) return;
      settled = true;
      cleanup();
      resolve({
        transcriptText,
        durationSec: audioDurationSeconds,
      });
    }

    function finishErr(e: Error) {
      if (settled) return;
      settled = true;
      cleanup();
      reject(e);
    }
  });
}
