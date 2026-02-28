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
      description: `Search the internal project database. Use this ONLY for retrieving static project documentation, such as technical specifications, building codes,
      and manufacturer installation requirements (e.g., '07 24 00 EIFS mesh overlap'). DO NOT use this tool to search for dynamic site data, historical weather conditions, crew sizes, or daily logs, as that information is not stored here.`,
      schema: z.object({
        reasoning: z.string().describe(
          "Use this field FIRST as a chain of thought scratchpad to justify your search. " +
          "You should explicitly answer the following questions in your chain of thought:" +
          "1. KNOWLEDGE GAP: What specific technical detail am I missing? " +
          "2. NECESSITY CHECK: Is this missing information critical for documenting compliance or liability? If it is trivial, general knowledge, or out-of-scope, explicitly state that you will abandon the search and rely on general context. "
        ),
        query: z.string().describe('The question or topic to search for'),
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
      description: `Search the live web using Exa. Use this specifically for external, publicly available data that would not be in a project specification, such as historical weather conditions for a specific date and location. 
      CRITICAL GUARDRAIL: If you do not have the exact required parameters for your search (e.g., you do not know the specific date or location for a weather query), DO NOT use this tool. Skip the search entirely and use the [MISSING: <Data Type>] placeholder instead.
      RULE: Whenever you use information retrieved from this tool, you MUST explicitly cite the source website or URL in the report text so the reviewing engineer can verify the data.`,
      schema: z.object({
        reasoning: z.string().describe(
          "Use this field FIRST as a chain of thought scratchpad to justify your search. " +
          "You should explicitly answer the following questions in your chain of thought:" +
          "1. KNOWLEDGE GAP: What specific technical detail am I missing? " +
          "2. NECESSITY CHECK: Is this missing information critical for documenting compliance or liability? If it is trivial, general knowledge, or out-of-scope, explicitly state that you will abandon the search and rely on general context. "
        ),
        query: z.string().describe('The search query optimized for a search engine'),
      }),
    }
  ),
];
