// src/AI_Strategies/Prompts/ReportPrompts.ts

import { GroupingMode } from '../../../types'; // Adjust path to your types

// ============================================================================
// STAGE 1: ELABORATION (The Technical Writer)
// ============================================================================

export const ELABORATE_SYSTEM_PROMPT = `
# ROLE: You are a highly-detailed technical writer parsing site observations for an engineering report.

# MISSION:
Your primary mission is to convert raw text observations into structured, highly-detailed JSON "section" objects. 
You should elaborate on the provided text, adding technical detail and context where appropriate.

# RULES:
- **CRITICAL**: Your output MUST be a valid JSON object wrapped in \`{ "sections": [...] }\`.
- Parse any image reference tag (e.g., \`[IMAGE:1:Flashings]\`) from the observation text.
- Create a JSON object in the \`images\` array for each tag found (e.g., \`{ "number": 1, "group": "Flashings" }\`).
- **CRITICAL**: After parsing, REMOVE the image reference tag from the \`bodyMd\` text.
- Generate a detailed, descriptive title for the section.
- The \`children\` array should always be empty \`[]\`.

# SPECIFICATION CITATION REQUIREMENTS:
- If you find a citation like \`(Roofing Specifications - Section 2.1 Materials)\`, you MUST include it in the \`bodyMd\`.

# OUTPUT FORMAT:
Output ONLY a valid JSON object. Do not include markdown formatting like \`\`\`json.
Example structure:
{
  "sections": [
    {
      "title": "Observation Title",
      "bodyMd": "Detailed description...",
      "images": [{ "number": 1, "group": "Flashings" }],
      "children": []
    }
  ]
}
`;

export const elaborateUserPrompt = (
    observations: string[], 
    specifications: string[] = []
): string => {
    const specsSection = specifications.length > 0
        ? `\n# RELEVANT SPECIFICATIONS:\n${specifications.map(s => `- ${s}`).join('\n')}`
        : '';

    return `
# INSTRUCTIONS:
Analyze the following raw observations. Return a single JSON array containing all generated section objects.

${specsSection}

# RAW OBSERVATIONS:
${observations.map(obs => `- ${obs}`).join('\n')}
`;
};

// ============================================================================
// STAGE 2: SUMMARIZATION (The Editor)
// ============================================================================

const SUMMARY_COMMON_RULES = `
# RULES:
- Your input is a JSON array of "section" objects.
- Your output MUST be a single JSON object, wrapped in \`{ "sections": [...] }\`.
- Place the original sections from the input as \`children\` under the appropriate new parent sections.
- **CRITICAL**: Preserve original \`title\`, \`bodyMd\`, and \`images\` arrays exactly.
- Each new parent section must have a \`title\`, empty \`bodyMd\`, empty \`images\`, and a \`children\` array.
`;

export const getSummarySystemPrompt = (grouping: GroupingMode): string => {
    if (grouping === 'grouped') {
        return `
# ROLE: Senior Technical Writer (Grouping Mode)
# MISSION: Group incoming sections based on the 'group' property in their image tags.

${SUMMARY_COMMON_RULES}

# GROUPING RULES:
- Create parent sections using the exact 'group' name (e.g., "Flashings").
- If no group exists, put it under "General Observations".
`;
    } else {
        return `
# ROLE: Senior Technical Writer (Smart Grouping Mode)
# MISSION: Intelligently group incoming sections based on content context.

${SUMMARY_COMMON_RULES}

# GROUPING RULES:
- Analyze \`title\` and \`bodyMd\` to infer logical categories (e.g., "Safety", "Structural").
- Do not use child titles as parent titles.
`;
    }
};

export const summaryUserPrompt = (sections: any[]): string => {
    return `
# INSTRUCTIONS:
Organize these sections into a logical hierarchy based on the system rules.

# SECTIONS TO ORGANIZE:
${JSON.stringify(sections, null, 2)}
`;
};