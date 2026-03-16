import { tool } from '@langchain/core/tools';
import { z } from 'zod';

export const planningTools = () => [
  // Define a tool for the architect to output the plan in structured format
   tool(
    async ({ sections, strategy }) => {
      console.log(`📐 Architect: Plan created with ${sections.length} sections`);
      return {
        status: 'SUCCESS',
        message: 'Report plan created. Awaiting approval.',
        sections,
        strategy
      };
    },
    {
      name: 'submitReportPlan',
      description: 'Submit the proposed report structure and strategy. Include all sections with their assigned photo IDs.',
      schema: z.object({
         reasoning: z.string().describe('Explain WHY you grouped photos this way.'),
        sections: z.array(z.object({
          sectionId: z.string().describe('Unique ID for section (e.g., "exec-summary", "observations")'),
          title: z.string().describe('Section title (e.g., "Executive Summary", "Observations")'),
          reportOrder: z.number().describe('The position this section should appear in the FINAL report (e.g. Executive Summary = 1, Recommendations = 2, Observations = 3)'),
          purpose: z.string().optional().describe('Why this section exists'),

          // ✅ The "Tuple" Strategy: Maps specific IDs to this section
          // The Builder will use these IDs to look up the full details in 'imageList'
          assignedImageIds: z.array(z.string()).describe('List of Photo IDs assigned to this section. MUST correspond to the [ID: ...] provided in context.'),
          
          // Optional: Nested subsections
          subsections: z.array(z.object({
            subSectionId: z.string(),
            title: z.string(),
            assignedImageIds: z.array(z.string()).optional(),
            purpose: z.string().optional()
          })).optional().describe('Breakdown of this section into specific areas')
        })).describe('List of sections in the report'),
        strategy: z.string().describe('Overall approach and reasoning for this structure'),
      }), 
    }
  ),
];