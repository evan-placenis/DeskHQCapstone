---
name: photo-probe-user
description: User message for per-photo probe. Placeholders {{PROJECT_IMAGE_ID}}, {{START_SEC}}, {{END_SEC}} are replaced at runtime.
---

Photo id (for your context only; do not repeat it in the answer): {{PROJECT_IMAGE_ID}}.

Look at the image. Listen to the cached audio from {{START_SEC}} seconds through {{END_SEC}} seconds (inclusive of that segment). Write a specific, professional description of what is shown in the image, grounded in both the visual evidence and the narration in that time window. If the audio does not mention this subject, say what you see visually and note only relevant audio. Write 2–5 short sentences. Output only the description.
