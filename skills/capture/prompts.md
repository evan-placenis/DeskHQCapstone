# Capture — prompt files

Per-photo multimodal probes (`describePhotoFromCachedAudio` in `capture-audio-transcription.ts`):

| File | Role |
|------|------|
| `photo-probe-system.md` | Per-photo probe **system** instruction. |
| `photo-probe-user.md` | Per-photo probe **user** message. Placeholders: `{{PROJECT_IMAGE_ID}}`, `{{START_SEC}}`, `{{END_SEC}}`. |

Also: `audio-processing.md` (orchestrator chat; rarely used)

There is **no** full-session master transcription step; `capture_sessions.transcript_text` is stored as an empty structured payload when probes complete.
