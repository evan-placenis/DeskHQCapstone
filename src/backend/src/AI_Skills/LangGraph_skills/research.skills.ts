import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { Container } from '../../config/container'; // Assuming your container is here
function sanitizeQuery(rawQuery: string): string {
  // Matches standard UUIDv4 formats
  const uuidRegex = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g;
  
  // Strip the UUID and clean up extra spaces
  return rawQuery.replace(uuidRegex, '').replace(/\s+/g, ' ').trim();
}

export const researchSkills = (
  projectId: string, 
) => [

  /**
   * Skill 1: Internal Memory Search
   * Replaces: private searchVectorStore()
   */
  tool(
    async ({ query }) => {
      try {
        const cleanQuery = sanitizeQuery(query);
        console.log(`🧠 [Research Skill] Searching Internal Memory: "${cleanQuery}"`);
        // KnowledgeService.search takes string[] and returns string[]
        const results = await Container.knowledgeService.search([cleanQuery], projectId);

        if (!results || results.length === 0) return "No matches found.";

        // 2. Format for AI (The View Layer)
        // The tool decides the AI needs "[Source: ...]" to do its job
        const formattedText = results.map(item => {
          return `[Source: ${item.source}]\n${item.content}`;
        }).join('\n\n---\n\n');

        return `[MEMORY MATCH FOUND]:\n${formattedText}`;

      } catch (error) {
        console.error("Error searching internal memory:", error);
        return "Error accessing internal memory.";
      }
    },
    {
      name: 'searchInternalKnowledge',
      description: 'Search the internal project memory/database for information. ALWAYS try this first as it is the quickest and cheapest way to get information.',
      schema: z.object({
        query: z.string().describe('The question or topic to search for'),
        // reasoning: z.string().optional().describe('A "scratchpad" to think out loud and let the user know what you are thinking.'),
      }),
    }
  ),

  /**
   * Skill 2: Web Search (with Auto-Learning)
   * Replaces: public searchWeb() AND the "Learning" logic
   */
  tool(
    async ({ query}) => {
      try {
        const cleanQuery = sanitizeQuery(query);
        console.log(`🌎 [Skill] Searching Web (Exa): "${cleanQuery}"`);

        const result = await Container.exa.searchAndContents(cleanQuery, {
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
    {
      name: 'searchWeb',
      description: 'Search the live web using Exa. Use this if Internal Memory fails.',
      schema: z.object({
        query: z.string().describe('The search query optimized for a search engine'),
        // reasoning: z.string().optional().describe('Brief note for the user (e.g. "Searching web for additional context")'),
      }),
    }
  ),
];
