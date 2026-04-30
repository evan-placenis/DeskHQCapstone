import { tool } from 'ai';
import { z } from 'zod/v3';
import { Container } from '@/lib/container';
import { logger } from '@/lib/logger';

export type ResearchToolsOptions = {
  /**
   * When false, web search never persists excerpts to Pinecone (overrides tool input).
   * Use for background jobs where embedding quotas should not apply.
   */
  persistWebSearchToDb?: boolean;
};

function sanitizeQuery(rawQuery: string): string {
  const uuidRegex = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g;
  return rawQuery.replace(uuidRegex, '').replace(/\s+/g, ' ').trim();
}

export const researchTools = (projectId: string, options?: ResearchToolsOptions) => {
  const allowPersistFromOptions = options?.persistWebSearchToDb !== false;

  return {
  searchInternalKnowledge: tool({
    description:
      'Search the internal project memory/database for EXTERNAL information (standards, past project data, reference material). Do NOT use this for questions about the current report - use read_specific_sections or read_full_report instead.',
    inputSchema: z.object({
      reason: z.string().describe('Brief plan for using this tool Must fill out first.'),
      query: z.string().describe('The question or topic to search for'),
    }),
    execute: async ({ query }) => {
      try {
        const cleanQuery = sanitizeQuery(query);
        logger.info(`🧠 [Research Tool] Searching Internal Memory: "${cleanQuery}"`);
        const results = await Container.knowledgeService.search([cleanQuery], projectId);

        const formattedContext = results.map(doc => {
          return `--- Document: ${doc.source} ---\n${doc.content}\n`;
        }).join('\n');

        if (results && results.length > 0) {
          return `[MEMORY MATCH FOUND]:\n${formattedContext}`;
        }

        return 'No matches found in internal memory.';
      } catch (error) {
        logger.error('Error searching internal memory:', error);
        return 'Error accessing internal memory.';
      }
    },
  }),

  searchWeb: tool({
    description:
      'Search the live web using Exa. Use this if Internal Memory fails. Omit persistToKnowledgeBase or set true to save results to project memory when allowed by the caller.',
    inputSchema: z.object({
      reason: z.string().describe('Brief plan for using this tool Must fill out first.'),
      query: z.string().describe('The search query optimized for a search engine'),
      persistToKnowledgeBase: z
        .boolean()
        .optional()
        .describe(
          'When true or omitted, web excerpts may be saved to the knowledge base for later retrieval (if the environment allows). Set false to skip embedding/Pinecone persistence.',
        ),
    }),
    execute: async ({ query, persistToKnowledgeBase }) => {
      try {
        const cleanQuery = sanitizeQuery(query);
        logger.info(`🌎 [Tool] Searching Web (Exa): "${cleanQuery}"`);

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

        const shouldPersist =
          allowPersistFromOptions && persistToKnowledgeBase !== false;
        if (shouldPersist) {
          Container.knowledgeService
            .saveWebDataToDatabase(content, primaryUrl, projectId)
            .catch((err: any) => logger.error('❌ [Tool] Background save failed:', err));
        }

        return content;
      } catch (error) {
        logger.error('Exa search failed:', error);
        return 'Error executing web search.';
      }
    },
  }),
};
};
