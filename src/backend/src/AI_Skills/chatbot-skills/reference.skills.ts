import { tool } from 'ai';
import { z } from 'zod';
import { SupabaseClient } from '@supabase/supabase-js';

export const referenceSkills = (client: SupabaseClient) => ({
  
  // 🧠 The "Smart" Tool: Allows the agent to look up how to write well
  findBestPracticeExample: tool({
    description: 'Search for a "Gold Standard" example of a specific report section to mimic its style, tone, and formatting.',
    inputSchema: z.object({
      category: z.string().describe('The trade or topic (e.g., "Roofing", "Electrical", "Executive Summary")'),
      reasoning: z.string().optional()
    }),
    execute: async ({ category }) => {
      console.log(`📚 [Reference Skill] Looking for perfect examples of: ${category}`);

      // 1. (Simple Version) Query a 'report_templates' or 'examples' table
      // In the future, you can upgrade this to Vector Search (Embeddings)
      const { data, error } = await client
        .from('report_examples') 
        .select('content, tips')
        .textSearch('tags', category) // or .eq('category', category)
        .limit(1)
        .single();

      if (error || !data) {
        return { 
          status: "NOT_FOUND", 
          guidance: "No specific example found. Use standard professional engineering tone: 'Observed [Issue]. Recommended [Action].'" 
        };
      }

      return {
        status: "FOUND",
        example_snippet: data.content, // The Agent will read this and mimic it
        writing_tips: data.tips || "Focus on brevity and clarity."
      };
    }
  })
});