import { tool } from 'ai';
import { z } from 'zod';
import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

export const referenceTools = (client: SupabaseClient) => ({
  findBestPracticeExample: tool({
    description: 'Search for a "Gold Standard" example of a specific report section to mimic its style, tone, and formatting.',
    inputSchema: z.object({
      reason: z.string().describe('Brief Reasoning. Must fill out first.'),
      category: z.string().describe('The trade or topic (e.g., "Roofing", "Electrical", "Executive Summary")'),
    }),
    execute: async ({ category }) => {
      logger.info(`📚 [Reference Tool] Looking for perfect examples of: ${category}`);

      const { data, error } = await client
        .from('report_examples')
        .select('content, tips')
        .textSearch('tags', category)
        .limit(1)
        .single();

      if (error || !data) {
        return {
          status: 'NOT_FOUND',
          guidance: "No specific example found. Use standard professional engineering tone: 'Observed [Issue]. Recommended [Action].'",
        };
      }

      return {
        status: 'FOUND',
        example_snippet: data.content,
        writing_tips: data.tips || 'Focus on brevity and clarity.',
      };
    },
  }),
});
