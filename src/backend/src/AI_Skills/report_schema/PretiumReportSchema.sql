-- 1. Create the table if it doesn't exist
CREATE TABLE IF NOT EXISTS report_templates (
  id TEXT PRIMARY KEY, -- We use text IDs like 'observation' for easier lookups
  name TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  user_prompt TEXT NOT NULL, -- The "Base" task
  structure_instructions TEXT NOT NULL, -- The rules for Hybrid metadata
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Insert the "Observation Report" Template
-- We use ON CONFLICT to update it if you run this script again
INSERT INTO report_templates (id, name, system_prompt, user_prompt, structure_instructions)
VALUES (
  'observation', 
  'Observation Report',
  
  -- SYSTEM PROMPT (The Persona & Behavior)
  'You are an expert Construction Site Inspector. Your goal is to write a detailed, professional observation report.
   
   CORE BEHAVIORS:
   1. EVIDENCE-BASED: You must call "getProjectImages" and analyze them before writing observations.
   2. INCREMENTAL: Write one section at a time using the "updateSection" tool.
   3. HYBRID DATA: You MUST use the "metadata" field in "updateSection" to flag issues.
      - If you find a defect, set metadata to: { "severity": "critical" | "major" | "minor", "status": "non-compliant" }
      - If the work is good, set metadata to: { "status": "compliant" }
   4. TONE: Professional, objective, and concise. Use active voice.',

  -- USER PROMPT (The Base Task)
  'Please generate an Observation Report for this project. Review the available project specifications and any selected images. Identify any construction defects, safety hazards, or progress updates.',

  -- STRUCTURE INSTRUCTIONS (The Layout Rules)
  'Follow this section structure loosely (it is your job to determine the best logical structure for the report):
   
   1. "Executive Summary" (ID: exec-summary)
      - Summarize key findings. No images here.
   
   2. "Site Conditions" (ID: site-conditions)
      - Brief overview of weather/access if known.
   
   3. "Observations" (ID: observations)
      - This is the core section. 
      - Group your findings by trade or area (e.g., "### Roofing", "### Electrical").
      - For each observation with an image, use this Markdown Table format:
        | Description | Photo |
        | :--- | :--- |
        | **Observation:** Describe what you see.<br>**Recommendation:** How to fix it. | ![Image Caption](IMAGE_ID_HERE) |
   
   4. "Recommendations" (ID: recommendations)
      - A bulleted list of next steps.'
)
ON CONFLICT (id) DO UPDATE SET
  system_prompt = EXCLUDED.system_prompt,
  user_prompt = EXCLUDED.user_prompt,
  structure_instructions = EXCLUDED.structure_instructions;


















-- import { z } from 'zod';
-- // 1. Define your schemas
-- export const ObservationSchema = z.object({
--   title: z.string(),
--   sections: z.array(z.object({
--     heading: z.string().describe("Main section headings e.g. '# Executive Summary','# Site Conditions', '# Observations', '# Recommendations'"),
--     description: z.string().optional().describe("The description of the main section (Optional)"),

--     subSections: z.array(z.object({
--       heading: z.string().describe("Sub section headings e.g. '## Roofing', '## Electrical', '## South Side' ect "),
--       description: z.string().optional().describe("The description of the sub section (Optional)"),
--       content: z.string().optional().describe(
--         "The content for this sub-section. If specific observations and images are required, you MUST output a valid 2-column Markdown table here.")
--     }))
--   })).describe("All content written in markdown format")
-- });

-- const NewSchema = z.object({
--   newId: z.string(),
--   severity: z.enum(['critical', 'major', 'minor']),
--   // ... other specific fields
-- });

-- // 2. Create the Registry
-- export const ReportSchemas = {
--   'observation': ObservationSchema,
--   'new': NewSchema,
--   // Add more here
-- } as const; // 'as const' makes TS inferred types strict

-- // 3. Helper to get the schema safely
-- export function getReportSchema(type: string) {
--   return ReportSchemas[type as keyof typeof ReportSchemas] || ReportSchemas['observation'];
-- }