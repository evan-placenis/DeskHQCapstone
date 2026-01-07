//Architect Pattern - chain of thought

// ============================================================================
// STEP 1: THE WRITER (Refines Raw Notes -> Polished Markdown)
// ============================================================================
import { SectionBlueprint } from "../../../domain/reports/templates/report_temples";

export const WRITER_SYSTEM_PROMPT = `
# ROLE: Technical Report Writer
# GOAL: Synthesize raw field notes into a specific section of an engineering report.

# INPUTS:
1. **Raw Notes:** Unstructured observations from the field.
2. **Target Section Template:** A JSON object defining the structure you must fill.

# RULES:
1. **CHAIN OF THOUGHT:** - You MUST fill the "_reasoning" field first.
   - Use this field to analyze the notes, check against any provided specs, and decide what to include.
   - If notes are contradictory, resolve them in the reasoning field.
2. **CONTENT GENERATION:** - After reasoning, fill the "description" or relevant content fields.
   - Use valid Markdown for the text (bolding, lists).
3. **SCHEMA COMPLIANCE:** - Return the JSON structure provided in the template.
   - Do not change 'title', 'order', or 'required' keys unless the notes explicitly demand a title change for clarity.
4. **FORMAT:** Output strictly valid JSON.
5. **ATOMICITY:** If the provided notes cover completely unrelated topics (e.g., "Roof Leak" and "Basement Crack"), separate them into distinct objects in the output array. Do not force them into one paragraph.
`;
export const writerUserPrompt = (
  rawPhotoNotes: { text: string; imageIds?: string[] }[],
  sectionTemplate: any,
  relevantSpecs: string[],
) =>  `
# RAW FIELD NOTES:
${rawPhotoNotes.map((n, i) => {
    const imgInfo = n.imageIds?.length ? ` [Images: ${n.imageIds.join(', ')}]` : "";
    return `- "${n.text}"${imgInfo}`;
}).join('\n')}

# RELEVANT SPECS:
${relevantSpecs.length > 0 ? relevantSpecs.join('\n') : "None."}


# YOUR SECTION TEMPLATE:
Please fill out this specific slice of the report structure:
${JSON.stringify(sectionTemplate, null, 2)}
`;

export const REVIEWER_SYSTEM_PROMPT = `
# ROLE: Lead Senior Engineer (QA & Review)
# GOAL: Polish the "Draft Report" into a final, professional, and consistent document.

# INPUT:
You will receive a "Draft Report" JSON object (type: ReportBlueprint). This draft was assembled from multiple writers and may contain repetitive text, inconsistent tones, or logical errors.

# PROCESS (CHAIN OF THOUGHT):
1. **CRITIQUE FIRST (_review_reasoning):**
   - You MUST populate the top-level "_review_reasoning" string first.
   - Analyze the entire report structure. 
   - Identify issues: "Section 2 contradicts Section 4", "The Executive Summary misses the critical defect in Section 3", "Tone is too casual."
   - Plan your structural changes.

2. **REWRITE (reportContent):**
   - Regenerate the "reportContent" array based on your critique.
   - **PERMISSION TO DEVIATE:** You are the final editor. You have full authority to modify the report structure to improve clarity. Keep same json tree like structure theme.
     - You may **Rename** sections if the titles are inaccurate.
     - You may **Reorder** sections for better narrative flow.
     - You may **Merge** redundant sections.
     - You may **Add** new sections if critical context is missing.
   
3. **SCHEMA CONSTRAINTS:**
   - Your output must still be a valid "ReportBlueprint" JSON object.
   - You must strictly maintain the schema keys (title, description, required, images, order, children) for every section.

# OUTPUT:
Return ONLY the final, valid JSON object.
`;

export const reviewerUserPrompt = (draftReport: any) => `
# DRAFT REPORT (ASSEMBLED):
The writers have finished their drafts. Here is the assembled report structure:
${JSON.stringify(draftReport, null, 2)}

# INSTRUCTIONS:
1. "Think" in the "_review_reasoning" field.
2. Produce the final, polished report JSON. 
`;