import { tool } from 'ai';
import { z } from 'zod/v3';
import { Container } from '../../config/container';


// Factory function to inject context (like projectId) into tools
export const reportSkills = (projectId: string, userId: string) => ({

  // TOOL: Write or Generate a Section
  generateSectionContent: tool({
    description: 'Generate detailed technical content for a specific report section. This tool retrieves project context and writes the text.',
    inputSchema: z.object({
      sectionTitle: z.string().describe('The title of the section (e.g., "Executive Summary")'),
      topic: z.string().describe('The specific topic or question to cover in this section'),
      tone: z.enum(['technical', 'business', 'academic']).optional().default('technical'),
    }),
    execute: async ({ sectionTitle, topic, tone }) => {
      console.log(`✍️ [Skill: Write] Generating content for "${sectionTitle}"...`);

      try {
        // 1. Retrieve RAG Context first (Critical for quality)
        const contextDocs = await Container.knowledgeService.search(topic, projectId);

        // 2. Format context for the LLM
        // (Note: We don't call another LLM here; we return the data so the Main Agent can write it)
        return {
          status: 'CONTEXT_RETRIEVED',
          instruction: `Use the following context to write the "${sectionTitle}" section.`,
          context: contextDocs.map(d => d.content).join('\n\n').substring(0, 3000), // Limit context size
          targetSection: sectionTitle
        };

      } catch (error) {
        console.error("❌ Generation failed:", error);
        return { status: 'ERROR', message: 'Failed to retrieve context.' };
      }
    },
  }),

  // TOOL: Save/Update Section to Database
  updateSection: tool({
    description: 'Save written content to a specific section in the report database. Use this AFTER generating content.',
    inputSchema: z.object({
      reportId: z.string(),
      sectionId: z.string().optional().describe('If updating an existing section'),
      title: z.string(),
      content: z.string().describe('The full markdown content to save'),
    }),
    execute: async ({ reportId, sectionId, title, content }) => {
      console.log(`💾 [Skill: Save] Saving "${title}"...`);

      try {
        // If we have an ID, update it. If not, create a new one.
        const savedSection = await Container.reportService.upsertSection(
          {
            report_id: reportId,
            id: sectionId, // optional
            title: title,
            description: content, // We store the body text in 'description' or 'content' column
            order_index: 0 // You might want to add logic to calculate this
          },
          Container.adminClient
        );

        return {
          status: 'SAVED',
          sectionId: savedSection.id,
          message: `Successfully saved section "${title}".`
        };
      } catch (error) {
        return { status: 'ERROR', message: 'Database save failed.' };
      }
    },
  }),

  // TOOL: Get Report Structure
  getReportStructure: tool({
    description: 'Get the current report structure and sections. Use this to understand what sections already exist.',
    inputSchema: z.object({
      reportId: z.string().optional().describe('The report ID if available'),
    }),
    execute: async ({ reportId }) => {
      try {
        // If we have a reportId, fetch it
        if (reportId) {
          const report = await Container.reportService.getReportById(reportId, Container.adminClient);
          if (report) {
            return {
              status: 'FOUND',
              reportId,
              sections: report.reportContent.map(s => ({
                id: s.id,
                title: s.title,
                hasContent: !!s.description
              }))
            };
          }
        }

        return {
          status: 'NEW',
          message: 'This is a new report. You can create sections using updateSection.'
        };
      } catch (error) {
        return {
          status: 'ERROR',
          message: `Error getting report structure: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
      }
    },
  }),
});