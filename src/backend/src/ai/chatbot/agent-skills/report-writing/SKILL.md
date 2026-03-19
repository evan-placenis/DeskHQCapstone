---
name: report-writing
description: SOP for AI-driven report section writing and project data retrieval.
---

## Workflow
1. Call `getProjectSpecs` to understand the project before writing.
2. Call `getReportStructure` to see existing sections and avoid duplication.
3. Call `getProjectImageIDS` then `getProjectImageURLsWithIDS` to retrieve images for observation sections.
4. Write sections incrementally using `updateSection`.

## Writing Rules
- Each section must have a unique `sectionId` and descriptive `heading`.
- Match heading levels to the existing report structure.
- For observation sections with associated photos, use Markdown tables (Description | Photo columns).
- Use `![Alt Text](UUID)` format for embedding images.
- Never use bullet points inside table cells — use `<br>` for line breaks.
- General observations without photos should be standard paragraphs or bullet points outside tables.

## Quality Standards
- Use professional engineering tone throughout.
- Flag non-compliant items with severity (critical, major, minor) when applicable.
- If information is missing, use `[MISSING: <description>]` rather than fabricating data.
