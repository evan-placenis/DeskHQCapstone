---
name: research
description: SOP for internal knowledge and web search behavior.
---

## Search Order
1. Always try `searchInternalKnowledge` first — it queries the project's vector store for specs, standards, and past project data.
2. Only fall back to `searchWeb` when internal memory returns no useful matches.

## When NOT to Search
- Do not search for information that is already in the current report or conversation context.
- Do not search for trivial general knowledge the model already knows.

## Citation
- When using web search results, cite the source URL so the reviewing engineer can verify.
- When using internal knowledge results, note that the source is internal project data.

## Guardrails
- If you lack the exact parameters for a search (e.g. specific date, location), skip the search and use a `[MISSING: <Data Type>]` placeholder instead.
- Never fabricate search results.
