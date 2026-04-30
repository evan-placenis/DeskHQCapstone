---
name: capture-photo-describer-user
description: User message template for Pass 2 (Describer). Placeholders {{PROJECT_IMAGE_ID}} and {{TRANSCRIPT_CHUNKS}} are replaced at runtime.
---

Image ID (for tracking only, do not reference in your output): {{PROJECT_IMAGE_ID}}

## Transcript chunks for this photo

{{TRANSCRIPT_CHUNKS}}

The photo is attached as an inline image. Write the professional field note for this photo, following your system instructions exactly. Output only the field note prose - no JSON, no formatting, no commentary.
