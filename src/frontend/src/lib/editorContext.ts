import type { Editor } from '@tiptap/react';

export interface OutlineEntry {
  level: number;
  text: string;
  /** ProseMirror position of the heading node */
  pos: number;
}

export interface ActiveSectionInfo {
  heading: string;
  level: number;
  markdown: string;
}

/**
 * The Map: extracts all heading nodes from the Tiptap document
 * and returns a plain-text Table of Contents / Outline.
 *
 * Example output:
 *   # Executive Summary
 *   ## Site Observations
 *   ### Structural Elements
 */
export function extractOutline(editor: Editor): OutlineEntry[] {
  const entries: OutlineEntry[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === 'heading') {
      const level = node.attrs.level as number;
      const text = node.textContent;
      if (text.trim()) {
        entries.push({ level, text, pos });
      }
    }
  });
  return entries;
}

/**
 * Serialize an outline into a plain-text string suitable for a system prompt.
 */
export function outlineToString(entries: OutlineEntry[]): string {
  return entries
    .map((e) => `${'#'.repeat(e.level)} ${e.text}`)
    .join('\n');
}

/**
 * The Lens: determines which heading section the user's cursor is inside
 * and extracts the Markdown for just that section.
 *
 * A "section" spans from the heading node to the next heading of the same
 * or higher level (or end of document).
 */
export function extractActiveSection(editor: Editor): ActiveSectionInfo | null {
  const { from } = editor.state.selection;
  const outline = extractOutline(editor);

  if (outline.length === 0) return null;

  // Find the heading that precedes (or is at) the cursor position
  let activeIdx = -1;
  for (let i = outline.length - 1; i >= 0; i--) {
    if (outline[i].pos <= from) {
      activeIdx = i;
      break;
    }
  }

  if (activeIdx === -1) return null;

  const active = outline[activeIdx];

  // Find the end of this section: next heading at same or higher (lower number) level
  const doc = editor.state.doc;
  let sectionEnd = doc.content.size;
  for (let i = activeIdx + 1; i < outline.length; i++) {
    if (outline[i].level <= active.level) {
      sectionEnd = outline[i].pos;
      break;
    }
  }

  // Slice the document between the heading and the section end, then serialize to markdown
  try {
    const slice = doc.slice(active.pos, sectionEnd);
    const storage = (editor.storage as any).markdown;
    const markdown: string = storage?.serializer?.serialize(slice.content) ?? '';
    return {
      heading: active.text,
      level: active.level,
      markdown,
    };
  } catch {
    return null;
  }
}

/**
 * Extract the markdown content for specific sections by heading name.
 * Used by the client-side `read_specific_sections` tool.
 */
export function extractSectionsByHeading(
  editor: Editor,
  headings: string[]
): Record<string, string> {
  const outline = extractOutline(editor);
  const doc = editor.state.doc;
  const result: Record<string, string> = {};
  const normalizedHeadings = headings.map((h) => h.trim().toLowerCase());

  for (let i = 0; i < outline.length; i++) {
    const entry = outline[i];
    const normalizedText = entry.text.trim().toLowerCase();

    if (!normalizedHeadings.includes(normalizedText)) continue;

    // Find section end (next heading at same or higher level)
    let sectionEnd = doc.content.size;
    for (let j = i + 1; j < outline.length; j++) {
      if (outline[j].level <= entry.level) {
        sectionEnd = outline[j].pos;
        break;
      }
    }

    try {
      const slice = doc.slice(entry.pos, sectionEnd);
      const storage = (editor.storage as any).markdown;
      const markdown: string = storage?.serializer?.serialize(slice.content) ?? '';
      result[entry.text] = markdown;
    } catch {
      result[entry.text] = '[Error extracting section]';
    }
  }

  return result;
}

/** Anchor for structure-based insertion or replacement (no selection) */
export type InsertAnchor =
  | 'start_of_report'
  | 'end_of_report'
  | { afterHeading: string }
  | { replaceSection: string };

/**
 * Get the ProseMirror position for inserting content at a structural anchor.
 * Used when the AI proposes insertion (e.g. intro at start, conclusion at end, section after X).
 * Returns null for replaceSection anchors (use getRangeForReplaceSection instead).
 */
export function getPositionForInsertAnchor(
  editor: Editor,
  anchor: InsertAnchor
): number | null {
  const doc = editor.state.doc;
  if (anchor === 'start_of_report') {
    return 0;
  }
  if (anchor === 'end_of_report') {
    return doc.content.size;
  }
  if (typeof anchor === 'object' && 'replaceSection' in anchor) {
    return null; // Use getRangeForReplaceSection for replace operations
  }
  const outline = extractOutline(editor);
  const targetHeading = typeof anchor === 'object' && 'afterHeading' in anchor ? anchor.afterHeading : '';
  const normalizedTarget = targetHeading.trim().toLowerCase();
  for (let i = 0; i < outline.length; i++) {
    const entry = outline[i];
    if (entry.text.trim().toLowerCase() === normalizedTarget) {
      // Insert after this section: position = start of next section (or doc end)
      let sectionEnd = doc.content.size;
      for (let j = i + 1; j < outline.length; j++) {
        if (outline[j].level <= entry.level) {
          sectionEnd = outline[j].pos;
          break;
        }
      }
      return sectionEnd;
    }
  }
  return null;
}

/**
 * Get the ProseMirror range (from, to) for replacing an entire section by heading name.
 * Used when the AI proposes editing a section (e.g. "make the conclusion more concise").
 */
export function getRangeForReplaceSection(
  editor: Editor,
  heading: string
): { from: number; to: number } | null {
  const outline = extractOutline(editor);
  const doc = editor.state.doc;
  const normalizedTarget = heading.trim().toLowerCase();

  for (let i = 0; i < outline.length; i++) {
    const entry = outline[i];
    if (entry.text.trim().toLowerCase() === normalizedTarget) {
      const sectionStart = entry.pos;
      let sectionEnd = doc.content.size;
      for (let j = i + 1; j < outline.length; j++) {
        if (outline[j].level <= entry.level) {
          sectionEnd = outline[j].pos;
          break;
        }
      }
      return { from: sectionStart, to: sectionEnd };
    }
  }
  return null;
}
