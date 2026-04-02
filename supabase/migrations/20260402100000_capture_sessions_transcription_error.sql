-- User-visible error when transcription_status = 'failed' (Trigger.dev job terminal failure).
ALTER TABLE public.capture_sessions
  ADD COLUMN IF NOT EXISTS transcription_error text;

COMMENT ON COLUMN public.capture_sessions.transcription_error IS
  'Set when transcription fails; cleared when transcription_status becomes ready';
