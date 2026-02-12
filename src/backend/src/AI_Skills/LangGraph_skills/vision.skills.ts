import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { Container } from '../../config/container';

// You can export multiple related tools from one file
export const visionSkills = [

  tool(
    async ({ images, focus }) => {
      try {
        // images is now an array of { url, id }
        // We pass the REAL ID to the vision agent so logs/tracking make sense
        const analysisRequests = images.map(img => ({
          id: img.id, // Keep the UUID!
          url: img.url
        }));

        console.log(`👁️ Analyzing batch of ${images.length} images...`);
        const analyses = await Container.visionAgent.analyzeBatch(analysisRequests);

        // Map results back to a string, but KEEP THE UUID in the text header
        const results = analyses.map((analysis) => {
          const focusText = focus ? `Focus: ${focus}\n` : '';
          // 👇 CRITICAL: The header now includes the UUID
          return `### Analysis for Image ID: ${analysis.imageId}\n${focusText}${analysis.description}`;
        });

        return results.join('\n\n---\n\n');
      } catch (error) {
        console.error("Error analyzing batch images:", error);
        return "Error: Failed to analyze images. Please verify URLs are accessible.";
      }
    },
    {
      name: 'analyze_batch_images',
      description: 'Analyzes a batch of images to extract visual evidence.',
      schema: z.object({
        // 👇 CHANGED: Accept objects so we keep ID + URL linked
        images: z.array(z.object({
          url: z.string().describe('Signed URL of the image'),
          id: z.string().describe('The UUID of the image (keep this from the source!)')
        })).describe('List of images to analyze'),
        
        focus: z.string().optional().describe('Specific visual elements to look for (e.g. "water damage", "safety hazards")'),
        reasoning: z.string().optional()
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
