import { tool } from 'ai';
import { z } from 'zod/v3';
import { Container } from '../../config/container';

// You can export multiple related tools from one file
export const audioSkills = {

  audioSKill1TODO: tool({
    description: 'TODO',
    inputSchema: z.object({
      imageUrls: z.array(z.string()).describe('List of image URLs to analyze'),
      reasoning: z.string().optional().describe('Brief note for the user (e.g. "Analyzing photos for site conditions")'),
    }),
    execute: async ({ imageUrls, focus }: { imageUrls: string[]; focus?: string }) => {
      try {
        // Transform URLs to the format expected by analyzeBatch
        const images = imageUrls.map((url, index) => ({
          id: `image-${index + 1}`,
          url: url
        }));

        // TODO: Implement audio analysis

      } catch (error) {
        console.error("Error:", error);
        return "Error.";
      }
    },
  }),

  audioSKill2TODO: tool({
    description: 'TODO',
    inputSchema: z.object({
      imageUrl: z.string().describe('URL of the schematic image to analyze'),
      imageId: z.string().optional().describe('Optional ID for tracking'),
      reasoning: z.string().optional().describe('Brief note for the user (e.g. "Analyzing schematic for details")'),
    }),
    execute: async ({ imageUrl, imageId }: { imageUrl: string; imageId?: string }) => {
      try {
        //TODO
      } catch (error) {
        console.error("Error :", error);
        return "Error.";
      }
    },
  }),

};