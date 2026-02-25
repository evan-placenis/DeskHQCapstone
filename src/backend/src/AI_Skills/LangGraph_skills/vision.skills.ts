import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { Container } from '../../config/container';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Vision tools with optional report context. When reportId and client are provided,
 * AI descriptions from batch analysis are persisted to report_images.ai_description.
 * Requires: ALTER TABLE report_images ADD COLUMN IF NOT EXISTS ai_description TEXT;
 */
export function visionSkillsWithReport(reportId?: string, client?: SupabaseClient) {
  return [
    tool(
    async ({ images, focus }) => {
      try {
        const analysisRequests = images.map((img: { url: string; id: string }) => ({ id: img.id, url: img.url }));

        console.log(`👁️ Analyzing batch of ${images.length} images...`);
        const analyses = await Container.sitePhotoAgent.analyzeBatch(analysisRequests);

        // Persist AI descriptions to report_images when in report context
        if (reportId && client && analyses.length > 0) {
          for (const a of analyses) {
            const { error } = await client
              .from('report_images')
              .update({ ai_description: a.description })
              .eq('report_id', reportId)
              .eq('image_id', a.imageId);
            if (error) {
              console.warn(`[Vision] Could not update report_images.ai_description for image ${a.imageId}:`, error.message);
            }
          }
          console.log(`✅ Stored ${analyses.length} AI description(s) to report_images`);
        }

        const results = analyses.map((analysis: { imageId: string; description: string }) => {
          const focusText = focus ? `Focus: ${focus}\n` : '';
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
        const analysis = await Container.sitePhotoAgent.analyzeImage(imageUrl, imageId || 'schematic');
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
}

/** Default for use where report context is not available (e.g. chat). */
export const visionSkills = visionSkillsWithReport();
