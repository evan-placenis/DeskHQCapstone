import { tool } from 'ai';
import { z } from 'zod/v3';
import { logger } from '@/lib/logger';

export const audioTools = {
  audioSKill1TODO: tool({
    description: 'TODO',
    inputSchema: z.object({
      imageUrls: z.array(z.string()).describe('List of image URLs to analyze'),
      reasoning: z.string().optional().describe('Brief note for the user (e.g. "Analyzing photos for site conditions")'),
    }),
    execute: async ({ imageUrls, focus }: { imageUrls: string[]; focus?: string }) => {
      try {
        const images = imageUrls.map((url, index) => ({
          id: `image-${index + 1}`,
          url,
        }));
        void images;
        void focus;

        return 'TODO';
      } catch (error) {
        logger.error('Error:', error);
        return 'Error.';
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
        void imageUrl;
        void imageId;
        return 'TODO';
      } catch (error) {
        logger.error('Error :', error);
        return 'Error.';
      }
    },
  }),
};
