import { tool } from 'ai';
import { z } from 'zod/v3';
import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Edit Skills - Section-by-name only (no selection)
 *
 * Use these tools ONLY when the user asks to edit a section by name or description
 * (e.g. "make the executive summary more concise") and has NOT selected/highlighted
 * any text in the report. Selection-based edits are handled entirely on the client;
 * do not call retrieveReportContext when the user has selected text or refers to
 * "this", "the selection", or "what I highlighted".
 */
export const editSkills = (reportId: string, client: SupabaseClient) => ({

  /**
   * Retrieve Report Context (section-by-name only)
   *
   * Call this ONLY when the user asks to edit a section by name (e.g. "executive summary",
   * "site conditions") and has NOT selected any text in the editor. Queries report_sections
   * to find the matching section. Do NOT call this if the user has highlighted text or
   * refers to "this", "the selection", or "what I highlighted" — those edits are handled
   * elsewhere.
   */
  retrieveReportContext: tool({
    description: 'Find a report section by name when the user asks to edit a section by name (e.g. "make the executive summary more concise") and has NOT selected any text. Do NOT use when the user has selected/highlighted text — selection edits are handled separately.',
    inputSchema: z.object({
      query: z.string().describe('Section name or description the user wants to edit (e.g. "executive summary")'),
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
