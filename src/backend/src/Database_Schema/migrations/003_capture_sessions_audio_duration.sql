-- Additive: add audio duration to capture_sessions for instant UI display
ALTER TABLE public.capture_sessions
ADD COLUMN IF NOT EXISTS audio_duration_seconds NUMERIC(10, 2) NULL;
