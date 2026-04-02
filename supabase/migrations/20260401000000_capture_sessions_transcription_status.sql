-- Per-session transcription lifecycle for UI (Processing → Ready).
ALTER TABLE public.capture_sessions
  ADD COLUMN IF NOT EXISTS transcription_status text NOT NULL DEFAULT 'idle'
  CHECK (transcription_status IN ('idle', 'queued', 'ready', 'failed'));

COMMENT ON COLUMN public.capture_sessions.transcription_status IS
  'idle: not queued; queued: Trigger.dev job pending/running; ready: transcript saved; failed: job exhausted';

-- Existing completed sessions
UPDATE public.capture_sessions
SET transcription_status = 'ready'
WHERE transcription_status = 'idle'
  AND transcript_text IS NOT NULL
  AND btrim(transcript_text) <> '';

-- For live badge updates in the app, enable Realtime on this table (Supabase Dashboard → Database → Replication,
-- or): ALTER PUBLICATION supabase_realtime ADD TABLE public.capture_sessions;
