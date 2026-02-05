import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { Container } from '../../../config/container';

// You can export multiple related tools from one file
export const visionSkills = [

  tool(
    async ({ imageUrls, focus }: { imageUrls: string[]; focus?: string }) => {
      try {
        // Transform URLs to the format expected by analyzeBatch
        const images = imageUrls.map((url, index) => ({
          id: `image-${index + 1}`,
          url: url
        }));

        // Call analyzeBatch once with all images - it handles parallelism internally
        const analyses = await Container.visionAgent.analyzeBatch(images);

        // Format results with optional focus context
        const results = analyses.map((analysis, index) => {
          const focusText = focus ? `Focus: ${focus}\n` : '';
          return `Image ${index + 1} (${imageUrls[index]}):\n${focusText}${analysis.description}`;
        });

        // Return one single, clean string to the Agent
        return results.join('\n\n');
      } catch (error) {
        console.error("Error analyzing batch images:", error);
        return "Error analyzing batch images.";
      }
    },
    {
      name: 'analyze_batch_images',
      description: 'Analyzes a LIST of images in parallel to extract visual evidence.',
      schema: z.object({
        imageUrls: z.array(z.string()).describe('List of image URLs to analyze'),
        focus: z.string().optional().describe('Specific thing to look for (e.g. "safety violations")'),
        reasoning: z.string().optional().describe('Brief note for the user (e.g. "Analyzing photos for site conditions")'),
      }),
    }
  ),

  tool(
    async ({ imageUrl, imageId }: { imageUrl: string; imageId?: string }) => {
      try {
        const analysis = await Container.visionAgent.analyzeImage(imageUrl, imageId || 'schematic');
        return analysis.description;
      } catch (error) {
        console.error("Error analyzing schematic:", error);
        return "Error analyzing schematic image.";
      }
    },
    {
      name: 'analyzeSchematic',
      description: 'Analyzes a single image to extract visual evidence.',
      schema: z.object({
        imageUrl: z.string().describe('URL of the schematic image to analyze'),
        imageId: z.string().optional().describe('Optional ID for tracking'),
        reasoning: z.string().optional().describe('Brief note for the user (e.g. "Analyzing schematic for details")'),
      }),
    }
  ),

];
