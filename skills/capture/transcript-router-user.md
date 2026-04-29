---
name: capture-transcript-router-user
description: User message template for Pass 1 (Router). Placeholders {{TRANSCRIPT_CHUNKS_JSON}} and {{PHOTOS_JSON}} are replaced at runtime.
---

Assign each transcript chunk to the most appropriate photo, following your system instructions exactly.

## Transcript chunks (JSON)

{{TRANSCRIPT_CHUNKS_JSON}}

## Photos (JSON, in capture order)

{{PHOTOS_JSON}}

The photo thumbnails are attached as inline images in the same order as the JSON above. Return only the routing JSON object specified by your system instructions.
