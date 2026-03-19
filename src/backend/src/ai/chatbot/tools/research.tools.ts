import { tool } from 'ai';
import { z } from 'zod/v3';
import { Container } from '../../../config/container';

function sanitizeQuery(rawQuery: string): string {
  const uuidRegex = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g;
  return rawQuery.replace(uuidRegex, '').replace(/\s+/g, ' ').trim();
}

export const researchTools = (projectId: string) => ({
  searchInternalKnowledge: tool({
    description:
      'Search the internal project memory/database for EXTERNAL information (standards, past project data, reference material). Do NOT use this for questions about the current report - use read_specific_sections or read_full_report instead.',
    inputSchema: z.object({
      query: z.string().describe('The question or topic to search for'),
    }),
    execute: async ({ query }) => {
      try {
        const cleanQuery = sanitizeQuery(query);
        console.log(`🧠 [Research Tool] Searching Internal Memory: "${cleanQuery}"`);
        const results = await Container.knowledgeService.search([cleanQuery], projectId);

        if (results && results.length > 0) {
          return `[MEMORY MATCH FOUND]:\n${results.join('\n\n')}`;
        }

        return 'No matches found in internal memory.';
      } catch (error) {
        console.error('Error searching internal memory:', error);
        return 'Error accessing internal memory.';
      }
    },
  }),

  searchWeb: tool({
    description: 'Search the live web using Exa. Use this if Internal Memory fails.',
    inputSchema: z.object({
      query: z.string().describe('The search query optimized for a search engine'),
    }),
    execute: async ({ query }) => {
      try {
        const cleanQuery = sanitizeQuery(query);
        console.log(`🌎 [Tool] Searching Web (Exa): "${cleanQuery}"`);

        const result = await Container.exa.searchAndContents(cleanQuery, {
          type: 'neural',
          useAutoprompt: true,
          numResults: 2,
          text: true,
        });

        if (!result.results || result.results.length === 0) {
          return 'No web results found.';
        }

        const content = result.results.map((r: any) => `SOURCE: ${r.title} (${r.url})\nCONTENT: ${r.text}`).join('\n\n');
        const primaryUrl = result.results[0].url;

        Container.knowledgeService
          .saveWebDataToDatabase(content, primaryUrl, projectId)
          .catch((err: any) => console.error('❌ [Tool] Background save failed:', err));

        return content;
      } catch (error) {
        console.error('Exa search failed:', error);
        return 'Error executing web search.';
      }
    },
  }),
});
