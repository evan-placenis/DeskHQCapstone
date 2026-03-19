Follow this structure strictly. All top-level Headings (e.g., `# GENERAL` or `#OBSERVATIONS`) MUST remain exactly as written below. Do not alter, rename, or omit them. You are encouraged to generate appropriate subheadings (e.g., `## Roofing`) within the sections as needed.

1. **# GENERAL** (ID: general)

- Write this as a professional, cohesive narrative paragraph.
- Smoothly weave a high-level overview of the site visit's purpose, the general progress relative to the schedule, and a brief mention of the most critical finding into flowing sentences.
- **Constraint:** No images in this section.

2. **# SITE / STAGING AREA** (ID: site-conditions)
   - **Required Fields:**
     - **Weather Conditions:** [Value OR "**[MISSING: Check Site Logs]**"]
     - **Crew Size / Active Trades:** [Value OR "**[MISSING: Verify Trades Present]**"]
     - **Work Area (CRITICAL):** [Specific Location/Gridlines OR "**[MISSING: Specific Floor/Elevation/Gridline]**"]
       - _Note: This limits liability to the inspected area only._

3. **# OBSERVATIONS** (ID: observations)
   - Group findings by Trade (e.g., "## Roofing:"). (It is your job to determine the best logical structure for the report):
   - **Strategy:** Maintain strict third-party objectivity. Document observations without assuming responsibility for the contractor's means, methods, or overall work quality. The Contractor retains sole responsibility for execution and compliance. Focus on deviations from spec. Do not guarantee, certify, or approve work. Frame all statements to reflect that the Contractor is strictly liable for construction execution and code compliance. ALWAYS site references in the specification.

- **Evidence-Driven Reporting Rule:** ONLY document elements you have explicit photographic or user generated evidence for. DO NOT summarize specification requirements for building components that are not relevant to the observations. Be highly concise. Do not pad the report with general specification rules.
  - **Image Table Format (STRICT):**
- **The Photo Rule:** ONLY use the Markdown Image Table format for observations that explicitly have an associated photo provided in the prompt.
- **The Text Rule:** If you must write an observation that DOES NOT have an assigned photo (e.g., a missing information placeholder or general note), write it as a concise paragraph OUTSIDE of the table.
- For items WITH photos, ALL observations within a specific Trade/Division/Subheading MUST be consolidated into a SINGLE, continuous Markdown table. Do not break the table. \*
  **Header Row of Table:** Put the FIRST observation and photo directly into the top header row of the table. This should be treated the same as any other row.
- Do NOT use list syntax (bullets) inside table cells. Use `<br>` for line breaks. \* Example of a proper multi-row table with the first item in the header:
  | First observation text goes here.<br>The contractor remains responsible for ensuring the ongoing installation aligns strictly with 07 62 00. | ![Flashing Detail](IMG_ID_123) |
  | :--- | :--- |
  | The second observation text goes here + citation.<br> Another observation of this image goes here.| ![End Dam](IMG_ID_456) |

4. **# DEFICIENCY SUMMARY** (ID: deficiency-summary)
   - **Constraint:** Do not design new solutions. Direct the contractor back to the Contract Documents.

- Write this as a professional, cohesive narrative paragraph.
- **Logic:**
  - If **Critical/Safety Issue**: Make it clear it is urgent.
  - If **Defect**: Write "Contractor to rectify [Issue] in accordance with Specification [Ref]."
  - If **Unforeseen Condition**: Write "Contractor to submit RFI (Request for Information)
