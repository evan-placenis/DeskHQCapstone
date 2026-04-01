"use client";

import { diff_match_patch } from 'diff-match-patch';

/**
 * Extracts the Markdown prefix and content from a line
 * Returns { prefix: string, content: string }
 */
function parseMarkdownLine(line: string): { prefix: string; content: string } {
  // Check for headers (# ## ### etc.)
  const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
  if (headerMatch) {
    return {
      prefix: headerMatch[1] + ' ',
      content: headerMatch[2],
    };
  }

  // Check for bullet points (- * +)
  const bulletMatch = line.match(/^([-*+])\s+(.+)$/);
  if (bulletMatch) {
    return {
      prefix: bulletMatch[1] + ' ',
      content: bulletMatch[2],
    };
  }

  // Check for numbered lists (1. 2. etc.)
  const numberedMatch = line.match(/^(\d+\.)\s+(.+)$/);
  if (numberedMatch) {
    return {
      prefix: numberedMatch[1] + ' ',
      content: numberedMatch[2],
    };
  }

  // Check for blockquote (>)
  const blockquoteMatch = line.match(/^(>)\s*(.+)$/);
  if (blockquoteMatch) {
    return {
      prefix: blockquoteMatch[1] + ' ',
      content: blockquoteMatch[2],
    };
  }

  // Check for code block (``` or ```language)
  const codeBlockMatch = line.match(/^(```\w*)$/);
  if (codeBlockMatch) {
    return {
      prefix: codeBlockMatch[1],
      content: '',
    };
  }

  // Check for table row (| ... |)
  const tableRowMatch = line.match(/^(\|.*\|)$/);
  if (tableRowMatch) {
    return {
      prefix: '',
      content: line, // Keep table rows as-is
    };
  }

  // Plain text line
  return {
    prefix: '',
    content: line,
  };
}

/**
 * Computes a structure-aware diff and returns Markdown with HTML span tags
 * for deletions and additions. This preserves Markdown structure so Tiptap
 * can properly parse it.
 * 
 * Strategy:
 * 1. Do line-by-line diff
 * 2. For each changed line, check if it's a deletion followed by an addition (structure change)
 * 3. If same structure (both bullets, both headers, etc.), preserve prefix and diff content
 * 4. If different structure, mark entire lines
 */
export function computeDiffDocument(
  currentMarkdown: string,
  newMarkdown: string
): string {
  const dmp = new diff_match_patch();
  
  const currentLines = currentMarkdown.split('\n');
  const newLines = newMarkdown.split('\n');
  
  // Use line-level diffing
  const lineChars = dmp.diff_linesToChars_(currentLines.join('\n'), newLines.join('\n'));
  const lineDiffs = dmp.diff_main(lineChars.chars1, lineChars.chars2, false);
  dmp.diff_charsToLines_(lineDiffs, lineChars.lineArray);
  dmp.diff_cleanupSemantic(lineDiffs);
  
  const result: string[] = [];
  let i = 0;
  
  while (i < lineDiffs.length) {
    const [operation, text] = lineDiffs[i];
    
    if (!text) {
      i++;
      continue;
    }
    
    // Split by newline but preserve empty lines
    const lines = text.split('\n');
    
    if (operation === 0) {
      // Unchanged - add as-is (including empty lines)
      for (const line of lines) {
        result.push(line);
      }
      i++;
    } else if (operation === -1 && i + 1 < lineDiffs.length && lineDiffs[i + 1][0] === 1) {
      // Deletion followed by Addition - likely a modification
      const deletedLines = lines.filter(l => l !== '');
      const addedText = lineDiffs[i + 1][1];
      const addedLines = addedText.split('\n').filter(l => l !== '');
      
      // Process line by line, matching deleted with added
      const maxLines = Math.max(deletedLines.length, addedLines.length);
      
      for (let lineIdx = 0; lineIdx < maxLines; lineIdx++) {
        const deletedLine = deletedLines[lineIdx] || '';
        const addedLine = addedLines[lineIdx] || '';
        
        if (!deletedLine && addedLine) {
          // Pure addition
          const parsed = parseMarkdownLine(addedLine);
          if (parsed.prefix && parsed.content) {
            result.push(`${parsed.prefix}<span data-diff="addition">${parsed.content}</span>`);
          } else {
            result.push(`<span data-diff="addition">${addedLine}</span>`);
          }
        } else if (deletedLine && !addedLine) {
          // Pure deletion
          const parsed = parseMarkdownLine(deletedLine);
          if (parsed.prefix && parsed.content) {
            result.push(`${parsed.prefix}<span data-diff="deletion">${parsed.content}</span>`);
          } else {
            result.push(`<span data-diff="deletion">${deletedLine}</span>`);
          }
        } else if (deletedLine && addedLine) {
          // Both exist - check structure
          const deletedParsed = parseMarkdownLine(deletedLine);
          const addedParsed = parseMarkdownLine(addedLine);
          
          // Check if same structure (same prefix type)
          const sameStructure = deletedParsed.prefix.trim() && 
                               addedParsed.prefix.trim() && 
                               deletedParsed.prefix.trim()[0] === addedParsed.prefix.trim()[0];
          
          if (sameStructure && deletedParsed.content && addedParsed.content) {
            // Same structure - preserve prefix, diff the content
            const contentDiffs = dmp.diff_main(deletedParsed.content, addedParsed.content);
            dmp.diff_cleanupSemantic(contentDiffs);
            
            // Build the merged content with spans
            let mergedContent = '';
            for (const [contentOp, contentText] of contentDiffs) {
              if (contentOp === 0) {
                mergedContent += contentText;
              } else if (contentOp === -1) {
                mergedContent += `<span data-diff="deletion">${contentText}</span>`;
              } else if (contentOp === 1) {
                mergedContent += `<span data-diff="addition">${contentText}</span>`;
              }
            }
            
            result.push(`${deletedParsed.prefix}${mergedContent}`);
          } else {
            // Different structure - mark entire lines
            result.push(`<span data-diff="deletion">${deletedLine}</span>`);
            result.push(`<span data-diff="addition">${addedLine}</span>`);
          }
        }
      }
      
      i += 2; // Skip both deletion and addition
    } else if (operation === -1) {
      // Pure deletion
      for (const line of lines) {
        if (line.trim() === '') {
          result.push('');
          continue;
        }
        const parsed = parseMarkdownLine(line);
        if (parsed.prefix && parsed.content) {
          result.push(`${parsed.prefix}<span data-diff="deletion">${parsed.content}</span>`);
        } else {
          result.push(`<span data-diff="deletion">${line}</span>`);
        }
      }
      i++;
    } else if (operation === 1) {
      // Pure addition
      for (const line of lines) {
        if (line.trim() === '') {
          result.push('');
          continue;
        }
        const parsed = parseMarkdownLine(line);
        if (parsed.prefix && parsed.content) {
          result.push(`${parsed.prefix}<span data-diff="addition">${parsed.content}</span>`);
        } else {
          result.push(`<span data-diff="addition">${line}</span>`);
        }
      }
      i++;
    } else {
      i++;
    }
  }
  
  return result.join('\n');
}
