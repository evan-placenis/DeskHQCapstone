import { tool } from '@langchain/core/tools';
import { z } from 'zod';

export const planningTools = () => [
  // Define a tool for the architect to output the plan in structured format
   tool(
    async ({ sections, strategy, user_questions}) => {
      console.log(`📐 Architect: Plan created with ${sections.length} sections`);
      return {
        status: 'SUCCESS',
        message: 'Report plan created. Awaiting approval.',
        strategy,
        user_questions,
        sections,
      };
    },
    {
      name: 'submitReportPlan',
      description: 'Call this AFTER writing your reasoning as plain text. Submits the structured report plan for user approval.',
      schema: z.object({
        sections: z.array(z.object({
          purpose: z.string().optional().describe('The ONLY instruction the agent executing this section will see. Provide hyper-specific instructions. Do not just say "Summarize the roof".'),
          sectionId: z.string().describe('Unique ID for section (e.g., "exec-summary", "observations")'),
          title: z.string().describe('Section title (e.g., "Executive Summary", "Observations")'),
          reportOrder: z.number().describe('The position this section appears in the FINAL report (e.g. Introduction = 1, Observations = 2, Summary = 3)'),
          assignedImageIds: z.array(z.string()).optional().describe('Photo IDs assigned to this section. MUST match [ID: ...] values from context. Do not duplicate ids.'),
          subsections: z.array(z.object({
            purpose: z.string().optional().describe('The ONLY instruction the next agent sees for this subsection. Be hyper-specific.'),
            subSectionId: z.string(),
            title: z.string(),
            assignedImageIds: z.array(z.string()).optional().describe('Photo IDs for this subsection. Must match [ID: ...] values from context.'),
          })).optional().describe('Breakdown of this section into specific areas'),
        })).describe('List of sections in the report'),
        strategy: z.string().describe('A formal, user-facing summary of your structural approach. This is displayed in the approval modal.'),
        user_questions: z.array(z.string()).describe('Specific factual questions that cannot be answered from the evidence.'),
      }),
    }
  ),
];