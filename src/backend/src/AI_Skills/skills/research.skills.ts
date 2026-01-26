import { tool } from 'ai';
import { z } from 'zod/v3';
import { Container } from '../../config/container'; // Assuming your container is here

export const researchSkills = {

  /**
   * Skill 1: Internal Memory Search
   * Replaces: private searchVectorStore()
   */
  searchInternalKnowledge: tool({
    description: 'Search the internal project memory/database for information. ALWAYS try this first as it is the quickest and cheapest way to get information.',
    inputSchema: z.object({
      query: z.string().describe('The question or topic to search for'),
      projectId: z.string(),
    }),
    execute: async ({ query, projectId }) => {
      try {
        console.log(`🧠 [Research Skill] Searching Internal Memory: "${query}"`);
        // KnowledgeService.search takes string[] and returns string[]
        const results = await Container.knowledgeService.search([query], projectId);

        if (results && results.length > 0) {
          return `[MEMORY MATCH FOUND]:\n${results.join('\n\n')}`;
        }

        return "No matches found in internal memory.";
      } catch (error) {
        console.error("Error searching internal memory:", error);
        return "Error accessing internal memory.";
      }
    },
  }),

  /**
   * Skill 2: Web Search (with Auto-Learning)
   * Replaces: public searchWeb() AND the "Learning" logic
   */
  searchWeb: tool({
    description: 'Search the live web using Exa. Use this if Internal Memory fails.',
    inputSchema: z.object({
      query: z.string().describe('The search query optimized for a search engine'),
      projectId: z.string().describe('Required to save new findings to memory'), // Added for the "Learning" feature
    }),
    execute: async ({ query, projectId }) => {
      try {
        console.log(`🌎 [Skill] Searching Web (Exa): "${query}"`);

        const result = await Container.exa.searchAndContents(query, {
          type: "neural",
          useAutoprompt: true,
          numResults: 2,
          text: true
        });

        if (!result.results || result.results.length === 0) {
          return "No web results found.";
        }

        // Format findings
        const content = result.results.map((r: any) => `SOURCE: ${r.title} (${r.url})\nCONTENT: ${r.text}`).join("\n\n");
        const primaryUrl = result.results[0].url;

        // 🚀 FIRE-AND-FORGET "LEARNING" (Your existing logic)
        // We save this new knowledge to the DB in the background
        Container.knowledgeService.saveWebDataToDatabase(
          content,
          primaryUrl,
          projectId
        ).catch((err: any) => console.error("❌ [Skill] Background save failed:", err));

        return content;

      } catch (error) {
        console.error("Exa search failed:", error);
        return "Error executing web search.";
      }
    },
  })
};