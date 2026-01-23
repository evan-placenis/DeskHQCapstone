// templates/markdown_report_templates.ts

export type MarkdownSectionTemplate = {
    title: string;
    description: string;
    structure: string; // The "Few-Shot" example
    imageGuidance: string;
};

/**
 * Observation Report Template (Tiptap Optimized)
 * Focuses on "Text Left / Image Right" logic via grouping.
 */
export const ObservationReportMarkdownTemplate: MarkdownSectionTemplate[] = [
    {
        title: "Executive Summary",
        description: "High-level overview of site visit and critical findings.",
        imageGuidance: "Can place 1-2 establishing shots at the very top but usually do not. Do not overuse images here.",
        structure: `# Executive Summary


## General Summary
This report details the observations from the site visit on [Date]. 

- **Key Finding:** The foundation shows signs of settling.
- **Critical Issue:** Water intrusion noted in the basement.

## Scope
Visual inspection of the structural elements...`
    },
    {
        title: "Site Conditions",
        description: "Detailed photos of specific conditions. This needs the 'Column' look.",
        imageGuidance: "Format this section as a Markdown Table. Column 1 is the description, Column 2 is the image.",
        structure: `# Site Conditions

## Observed Conditions

| | |
| :--- | :--- |
| **Site Condition 1**<br>... | ![North Wall Crack](IMAGE_ID_2) |
| **Site Condition 2**<br>... | ![Water Stain](IMAGE_ID_3) |
| **Spalling**<br>Concrete spalling observed on the west pillar. | ![Spalling](IMAGE_ID_4) |`
    },
    {
        title: "3.0 Observations",
        description: "Technical analysis of defects.",
        imageGuidance: "Embed images strictly INSIDE the bullet point to keep them grouped with the text.",
        structure: `# 3.0 Observations


| | |
| :--- | :--- |
| **North Wall Crack**<br>Horizontal crack spanning 4ft. Indicates potential shear stress. | ![North Wall Crack](IMAGE_ID_2) |
| **Water Staining**<br>Active leak detected near the window frame. | ![Water Stain](IMAGE_ID_3) |
| **Spalling**<br>Concrete spalling observed on the west pillar. | ![Spalling](IMAGE_ID_4) |`
    },
    {
        title: "Recommendations",
        description: "Actionable next steps.",
        imageGuidance: "Use images only if they clarify the repair method.",
        structure: `# Recommendations

## Action Items

- **Immediate Repair:** Shoring required for the main beam.
- **Monitor:** Install crack monitors on the North Wall.
- **Further Testing:** Recommend GPR scan for the slab.`
    }
];

/**
 * Helper to inject this into the Prompt
 */
export function getTemplateStringForPrompt(templates: MarkdownSectionTemplate[]): string {
    return templates.map(t =>
        `SECTION: ${t.title}
         GOAL: ${t.description}
         IMAGE RULES: ${t.imageGuidance}
         EXPECTED FORMAT:
         ${t.structure}`
    ).join("\n\n----------------\n\n");
}