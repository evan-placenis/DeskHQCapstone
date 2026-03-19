---
name: vision
description: SOP for image and schematic analysis behavior.
---

## When to Use Vision Tools
- Use `analyze_batch_images` when analyzing multiple site photos (e.g. looking for damage, safety violations, conditions).
- Use `analyzeSchematic` for a single technical drawing or schematic.

## Output Format
- Return structured descriptions of what is observed.
- If a `focus` parameter is provided, prioritize that aspect in the analysis.
- Do not speculate beyond what is visually evident — flag uncertain observations explicitly.

## Integration with Reports
- When vision results feed into report writing, reference image IDs so they can be linked in the final document.
- Keep descriptions factual and suitable for professional engineering reports.
