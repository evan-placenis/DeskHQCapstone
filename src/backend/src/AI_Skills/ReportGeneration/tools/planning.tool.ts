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
        strategy: strategy,
        user_questions: user_questions,
        sections,
      };
    },
    {
      name: 'submitReportPlan',
      description: 'Submit the proposed report structure. Include all sections with their assigned photo IDs.',
      schema: z.object({
        // // 🧠 The Knowledge Map (The Architect's Brain)
        // knowledge_map: z.object({
        //   consensus: z.string().describe("What does this report collectively agree on? Cite at least 2 observations."),
        //   active_debates: z.string().describe("What notes/observations actively contradict each other? Name the topics."),
        //   strongest_evidence: z.string().describe("What claims are supported by the most robust evidence?"),
        //   open_questions: z.array(z.string()).describe("List the most important unanswered questions to help get facts right.")
        // }).describe("Maximum 400 words total across all fields. Use clear language. Do not use hedging phrases like 'it seems'."),
        reasoning: z.string().describe('Analyze the raw data and user request. Note any critical defects that require their own dedicated sections, and determine the logical flow of the report."'),
        sections: z.array(z.object({
          purpose: z.string().optional().describe('Provide hyper-specific instructions for the next agent. Do not just say "Summarize the roof".'),
          sectionId: z.string().describe('Unique ID for section (e.g., "exec-summary", "observations")'),
          title: z.string().describe('Section title (e.g., "Executive Summary", "Observations")'),
          reportOrder: z.number().describe('The position this section should appear in the FINAL report (e.g. Executive Summary = 1, Recommendations = 2, Observations = 3)'),

          // The Builder will use these IDs to look up the full details in 'imageList'
          assignedImageIds: z.array(z.string()).describe('List of Photo IDs assigned to this section. MUST correspond to the [ID: ...] provided in context.'),
          
          // Optional: Nested subsections
          subsections: z.array(z.object({
            purpose: z.string().optional().describe('Provide hyper-specific instructions for the next agent. Do not just say "Summarize the roof".'),
            subSectionId: z.string(),
            title: z.string(),
            assignedImageIds: z.array(z.string()).optional(),
          })).optional().describe('Breakdown of this section into specific areas')
        })).describe('List of sections in the report'),
        strategy: z.string().describe('A formal, user-facing explanation of your overall approach and reasoning for this report structure.'),  
        user_questions: z.array(z.string()).describe('A list of specific, individual questions for the user to answer to clarify contradictions or missing facts (e.g., "What material is the North elevation roof?").'),    
      }), 
    }
  ),
];