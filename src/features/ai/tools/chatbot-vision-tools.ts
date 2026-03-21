import { tool } from 'ai';
import { z } from 'zod/v3';
import { Container } from '@/lib/container';

export const visionTools = {
  analyze_batch_images: tool({
    description: 'Analyzes a LIST of images in parallel to extract visual evidence.',
    inputSchema: z.object({
      reason: z.string().describe('Brief plan for using this tool Must fill out first.'),
      imageUrls: z.array(z.string()).describe('List of image URLs to analyze'),
      focus: z.string().optional().describe('Specific thing to look for (e.g. "safety violations")'),
    }),
    execute: async ({ imageUrls, focus }: { imageUrls: string[]; focus?: string }) => {
      try {
        const images = imageUrls.map((url, index) => ({
          id: `image-${index + 1}`,
          url,
        }));

        const analyses = await Container.sitePhotoAgent.analyzeBatch(images);

        const results = analyses.map((analysis, index) => {
          const focusText = focus ? `Focus: ${focus}\n` : '';
          return `Image ${index + 1} (${imageUrls[index]}):\n${focusText}${analysis.description}`;
        });

        return results.join('\n\n');
      } catch (error) {
        console.error('Error analyzing batch images:', error);
        return 'Error analyzing batch images.';
      }
    },
  }),

  analyzeSchematic: tool({
    description: 'Analyzes a single image to extract visual evidence.',
    inputSchema: z.object({
      reason: z.string().describe('Brief plan for using this tool Must fill out first.'),
      imageUrl: z.string().describe('URL of the schematic image to analyze'),
      imageId: z.string().optional().describe('Optional ID for tracking'),
    }),
    execute: async ({ imageUrl, imageId }: { imageUrl: string; imageId?: string }) => {
      try {
        const analysis = await Container.sitePhotoAgent.analyzeImage(imageUrl, imageId || 'schematic');
        return analysis.description;
      } catch (error) {
        console.error('Error analyzing schematic:', error);
        return 'Error analyzing schematic image.';
      }
    },
  }),
};
