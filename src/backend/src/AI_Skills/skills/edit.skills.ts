import { tool } from 'ai';
import { z } from 'zod/v3';
import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Edit Skills - Tools for AI-powered report editing
 * 
 * The AI uses retrieveReportContext to find the relevant section.
 * The actual edit is generated via a separate non-streaming endpoint (/api/report/[reportId]/ai-edit)
 * to avoid streaming JSON order issues.
 */
export const editSkills = (reportId: string, client: SupabaseClient) => ({

  /**
   * Retrieve Report Context
   * 
   * Queries the report_sections table to find the relevant section.
   * Uses section-level FTS to find matching content.
   */
  retrieveReportContext: tool({
    description: 'Find the relevant section of the report based on what the user wants to edit. The system will then generate the edit using a separate process.',
    inputSchema: z.object({
      query: z.string().describe('What the user is asking about or wants to edit'),
    }),
    execute: async ({ query }) => {
      try {
        console.log(`🔍 [Edit Skill] Retrieving context for query: "${query}"`);

        // Check report tiptap_content (single source of truth for displayed text)
        const { data: report, error: reportError } = await client
          .from('reports')
          .select('tiptap_content')
          .eq('id', reportId)
          .single();

        if (reportError || !report) {
          return {
            status: 'ERROR',
            message: 'Report not found.'
          };
        }

        const tiptapContent = report.tiptap_content ?? '';
        if (!tiptapContent.trim()) {
          return {
            status: 'REPORT_EMPTY',
            message: 'The report has no content yet. Add or generate content before requesting edits.'
          };
        }

        // Get all sections for this report
        const { data: allSections, error: sectionsError } = await client
          .from('report_sections')
          .select('id, section_id, heading, content, order')
          .eq('report_id', reportId)
          .order('order');

        if (sectionsError || !allSections || allSections.length === 0) {
          return {
            status: 'NOT_FOUND',
            message: 'No sections found for this report. The report may need to be generated first.'
          };
        }

        const availableSections = allSections.map(s => s.heading);

        // Try FTS on report_sections table
        const { data: ftsMatches, error: ftsError } = await client
          .from('report_sections')
          .select('id, section_id, heading, content, order')
          .eq('report_id', reportId)
          .textSearch('fts', query, { type: 'websearch' })
          .order('order');

        if (!ftsError && ftsMatches && ftsMatches.length > 0) {
          const match = ftsMatches[0];
          console.log(`✅ [Edit Skill] FTS found section: "${match.heading}" (id: ${match.id})`);
          
          return {
            status: 'SUCCESS',
            sectionRowId: match.id,
            sectionId: match.section_id,
            sectionHeading: match.heading,
            originalText: match.content,
            availableSections
          };
        }

        // FTS didn't find a match - ask user to clarify
        console.log(`📝 [Edit Skill] No FTS match. Available sections: ${availableSections.join(', ')}`);
        
        return {
          status: 'NO_MATCH',
          message: `Could not find a section matching "${query}". Please specify which section you want to edit.`,
          availableSections,
          totalSections: allSections.length
        };

      } catch (error) {
        console.error('❌ [Edit Skill] Error retrieving context:', error);
        return {
          status: 'ERROR',
          message: error instanceof Error ? error.message : 'Failed to retrieve report context'
        };
      }
    }
  }),

});
