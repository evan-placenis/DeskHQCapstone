/**
 * Models (e.g. Gemini) sometimes wrap chain-of-thought in `<thinking>...</thinking>`.
 * That breaks ReactMarkdown: unknown tags, huge unbroken paragraphs, and headings glued
 * to `</thinking>` without newlines. Strip before rendering.
 */

/**
 * After `.!?`, models often glue the next bold section: `...board.**Active debates**`.
 * Without a line break, the whole bullet stays one paragraph. Insert a Markdown hard
 * break (two spaces + newline) before `**` so the bold block starts on a new line.
 */
function normalizeGluedBoldAfterSentenceEnd(content: string): string {
  let s = content;
  // `...text.**Bold` or `...text. **Bold`
  s = s.replace(/([.!?])\s*(\*\*)/g, "$1  \n$2");
  // `...text).**Bold` (common before a new labeled bold section)
  s = s.replace(/\)\s*(\*\*)/g, ")  \n$1");
  return s;
}

/**
 * Remove `<thinking>...</thinking>` blocks and hide incomplete opens while streaming.
 * Ensures ATX headings that were glued to prior text get a blank line so they parse.
 */
export function stripThinkingBlocksForMarkdown(content: string): string {
  let s = content;
  // Complete blocks (non-greedy)
  s = s.replace(/<thinking>[\s\S]*?<\/thinking>\s*/gi, "");
  // Streaming: drop from an unclosed `<thinking` to EOF
  const openMatch = /<thinking\b/i.exec(s);
  if (openMatch) {
    s = s.slice(0, openMatch.index).trimEnd();
  }
  // `foo</thinking>###` is handled by removing blocks; fix `foo###` → `foo` + breaks + `###`
  s = s.replace(/([^\n])(#{1,6}\s)/g, "$1\n\n$2");
  s = normalizeGluedBoldAfterSentenceEnd(s);
  return s.trim();
}
