import { tool } from 'ai';
import { z } from 'zod/v3';

/**
 * Parse a markdown string into a map of heading -> section content.
 * Handles # / ## / ### headings. Each section spans from its heading
 * to the next heading of the same or higher level (or EOF).
 */
function parseMarkdownSections(markdown: string): Map<string, string> {
  const lines = markdown.split('\n');
  const sections = new Map<string, string>();
  let currentHeading = '';
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
 * Returns chat-document tools that close over the live report markdown.
 * When no markdown is available, returns an empty object.
 */
export function chatContextTools(fullReportMarkdown?: string) {
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
            for (const [heading, content] of sectionMap) {
              if (heading.toLowerCase().includes(normalized) || normalized.includes(heading.toLowerCase())) {
                result[heading] = content;
                break;
              }
            }
          }
        }
        if (Object.keys(result).length === 0) {
          return {
            status: 'NOT_FOUND',
            message: `No sections found matching: ${sections.join(', ')}. Available sections: ${[...sectionMap.keys()].join(', ')}`,
          };
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
        reason: z.string().optional().describe('Brief reason for reading the full report'),
      }),
      execute: async () => {
        console.log('[ChatContext] read_full_report called, returning', fullReportMarkdown.length, 'chars');
        return { status: 'SUCCESS', markdown: fullReportMarkdown };
      },
    }),

    propose_structure_insertion: tool({
      description:
        'Propose adding or modifying content to the report at a structural location. ' +
        'WRITE (new content): Use insertLocation start_of_report, end_of_report, or after_heading. ' +
        'EDIT (modify existing section): Use insertLocation replace_section with targetHeading set to the section name (e.g. "Conclusion"). This REPLACES the section content. ' +
        'For edits like "make the conclusion more concise", "rewrite the intro", "shorten the executive summary" - use replace_section, NOT after_heading. ' +
        'First call read_specific_sections to get the current section content, then generate the revised content and call this tool with replace_section.',
      inputSchema: z.object({
        reason: z.string().describe('Brief plan for this insertion. Must fill out first.'),
        content: z
          .string()
          .describe('Full markdown to insert, including heading (e.g. ## Conclusion) and body. Use same heading level as neighboring sections.'),
        insertLocation: z
          .enum(['start_of_report', 'end_of_report', 'after_heading', 'replace_section'])
          .describe('Where to insert/replace: start_of_report, end_of_report, after_heading, or replace_section'),
        targetHeading: z
          .string()
          .optional()
          .describe('Required when insertLocation is after_heading or replace_section: the exact heading name from the report outline.'),
        
      }),
      execute: async ({ content, insertLocation, targetHeading, reason }) => {
        const anchor =
          insertLocation === 'end_of_report'
            ? 'end_of_report'
            : insertLocation === 'start_of_report'
              ? 'start_of_report'
              : insertLocation === 'replace_section'
                ? { replaceSection: targetHeading || '' }
                : { afterHeading: targetHeading || '' };

        let originalContent: string | undefined;
        if (insertLocation === 'replace_section' && targetHeading) {
          const normalized = targetHeading.trim().toLowerCase();
          for (const [heading, sectionContent] of sectionMap) {
            if (heading.toLowerCase() === normalized) {
              originalContent = sectionContent;
              break;
            }
          }
        }

        console.log('[ChatContext] propose_structure_insertion:', { anchor, contentLen: content.length, reason });

        return {
          status: 'SUCCESS',
          anchor,
          content,
          reason: reason ?? 'AI proposed insertion',
          ...(originalContent !== undefined && { originalContent }),
        };
      },
    }),
  };
}
