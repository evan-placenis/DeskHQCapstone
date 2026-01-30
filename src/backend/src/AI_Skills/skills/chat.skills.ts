import { tool } from 'ai';
import { z } from 'zod/v3';
import { Container } from '../../config/container';

export const chatSkills = (projectId: string, userId: string) => ({
  // TOOL 1: Update/Write Report Section
  updateSection: tool({
    description: 'Update or create a report section. Use this to write report content. The markdown will be parsed and structured.',
    inputSchema: z.object({
      sectionId: z.string().describe('The ID of the section to update, or a new ID if creating'),
      markdown: z.string().describe('The markdown content for the section'),
      title: z.string().optional().describe('Optional section title'),
    }),
    execute: async ({ sectionId, markdown, title }) => {
      try {
        console.log(`📝 [Report Skill] Updating section ${sectionId} for project ${projectId}`);

        // Note: In a real implementation, you might want to:
        // 1. Get the current report (if it exists)
        // 2. Find or create the section
        // 3. Update it with the new markdown
        // 4. Calculate diff if there's existing content

        // For now, we'll return success and let the orchestrator handle the final assembly
        // The actual saving happens after the stream completes

        return {
          status: 'SUCCESS',
          sectionId,
          message: `Section ${sectionId} updated successfully. Content will be saved when report generation completes.`,
          preview: markdown.substring(0, 200) + (markdown.length > 200 ? '...' : '')
        };
      } catch (error) {
        console.error("Error updating section:", error);
        return {
          status: 'ERROR',
          message: `Failed to update section: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
      }
    },
  }),
});

//NEED A SKILL FOR GETTING PREVIOUS USER MESSAGES