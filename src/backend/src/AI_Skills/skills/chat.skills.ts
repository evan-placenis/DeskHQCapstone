/**
 * Chat Skills – for the conversational Chat agent (ChatOrchestrator).
 *
 * The chat agent's role: when the user asks a question (about the report or
 * anything else), respond in the chat. Research skills (searchInternalKnowledge,
 * searchWeb) are added alongside so the chatbot can research when necessary to
 * answer the user's query. Report section writing and report-content editing
 * live in report.skills and the Edit flow, not here.
 *
 * The two document-reading tools below execute server-side using the full
 * report markdown sent from the frontend in the request body. This avoids
 * client-side tool round-trips which don't work cleanly with assistant-ui.
 */
import { tool } from 'ai';
import { z } from 'zod/v3';

/**
 * Parse a markdown string into a map of heading → section content.
 * Handles # / ## / ### headings. Each section spans from its heading
 * to the next heading of the same or higher level (or EOF).
 */
function parseMarkdownSections(markdown: string): Map<string, string> {
  const lines = markdown.split('\n');
  const sections = new Map<string, string>();
  let currentHeading = '';
  let currentLevel = 0;
  let currentLines: string[] = [];

  const flush = () => {
    if (currentHeading) {
      sections.set(currentHeading, currentLines.join('\n').trim());
    }
  };

  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.+)/);
    if (match) {
      flush();
      currentLevel = match[1].length;
      currentHeading = match[2].trim();
      currentLines = [line];
    } else {
      currentLines.push(line);
    }
  }
  flush();

  return sections;
}

/**
 * Factory: returns chat tools that close over the live report markdown
 * sent from the frontend. When no markdown is available, returns an
 * empty object so no broken tools are registered.
 */
export function chatSkills(fullReportMarkdown?: string) {
  if (!fullReportMarkdown?.trim()) return {};

  const sectionMap = parseMarkdownSections(fullReportMarkdown);

  return {
    read_specific_sections: tool({
      description:
        'Fetch the full markdown text of specific sections from the live document. ' +
        'Use this when you need details from sections not present in the current Active Section. ' +
        'Pass the exact heading names as they appear in the Document Outline.',
      inputSchema: z.object({
        sections: z
          .array(z.string())
          .describe('Array of section heading names to retrieve (e.g. ["Executive Summary", "Site Observations"])'),
      }),
      execute: async ({ sections }) => {
        console.log('[ChatContext] read_specific_sections called:', { sections });
        const result: Record<string, string> = {};
        for (const requested of sections) {
          const normalized = requested.trim().toLowerCase();
          for (const [heading, content] of sectionMap) {
            if (heading.toLowerCase() === normalized) {
              result[heading] = content;
              break;
            }
          }
          if (!result[requested]) {
            // Try partial match
            for (const [heading, content] of sectionMap) {
              if (heading.toLowerCase().includes(normalized) || normalized.includes(heading.toLowerCase())) {
                result[heading] = content;
                break;
              }
            }
          }
        }
        if (Object.keys(result).length === 0) {
          return { status: 'NOT_FOUND', message: `No sections found matching: ${sections.join(', ')}. Available sections: ${[...sectionMap.keys()].join(', ')}` };
        }
        return { status: 'SUCCESS', sections: result };
      },
    }),

    read_full_report: tool({
      description:
        'Fetch the entire live markdown of the report. ' +
        'Only use this for global questions like holistic summaries, full-document consistency checks, ' +
        'or when the user explicitly asks about the whole report.',
      inputSchema: z.object({
        reason: z
          .string()
          .optional()
          .describe('Brief reason for reading the full report'),
      }),
      execute: async () => {
        console.log('[ChatContext] read_full_report called, returning', fullReportMarkdown.length, 'chars');
        return { status: 'SUCCESS', markdown: fullReportMarkdown };
      },
    }),

    /**
     * Propose inserting new content at a structural location in the report.
     * Use when the user asks to WRITE something (conclusion, executive summary, intro, etc.)
     * WITHOUT highlighting a specific place. The insertion location is inferred from report
     * structure and standard conventions (e.g. conclusion goes at end).
     */
    propose_structure_insertion: tool({
      description:
        'Propose adding new content to the report at a structural location. ' +
        'Use when the user asks to write something (e.g. "write an intro", "add an executive summary", "write a conclusion") without selecting text. ' +
        'Use insertLocation: start_of_report for intros/overviews, end_of_report for conclusions/appendices, after_heading for content between sections. ' +
        'First call read_full_report to understand the report, then generate the content and call this tool. ',
      
      inputSchema: z.object({
        // 1. Keep content first to ensure safe streaming
        content: z
          .string()
          .describe('Full markdown to insert, including heading (e.g. ## Conclusion) and body. Use same heading level as neighboring sections.'),
        
        // 2. FLATTENED SCHEMA: Replace z.union with a simple enum
        insertLocation: z
          .enum(['start_of_report', 'end_of_report', 'after_heading'])
          .describe('Where to insert: start_of_report (intro, overview), end_of_report (conclusion, appendix), or after_heading (between sections)'),
          
        // 3. Optional string instead of a nested object
        targetHeading: z
          .string()
          .optional()
          .describe('If insertLocation is after_heading, provide the exact heading name. Otherwise omit.'),
          
        reason: z
          .string()
          .optional()
          .describe('Brief reason for this insertion'),
      }),
      
      execute: async ({ content, insertLocation, targetHeading, reason }) => {
        // Reconstruct the anchor object here so your React frontend 
        // doesn't break when it reads `structureInsertCall.result.anchor`
        const anchor = insertLocation === 'end_of_report'
          ? 'end_of_report'
          : insertLocation === 'start_of_report'
            ? 'start_of_report'
            : { afterHeading: targetHeading || '' };

        console.log('[ChatContext] propose_structure_insertion:', { anchor, contentLen: content.length, reason });
        
        return { 
          status: 'SUCCESS', 
          anchor, 
          content, 
          reason: reason ?? 'AI proposed insertion' 
        };
      },
    }),
  };
}
