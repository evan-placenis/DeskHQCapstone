"use client";

import { diffWordsWithSpace } from 'diff';
import type { Editor } from '@tiptap/core';
import type { JSONContent } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';

interface TextSegment {
  text: string;
  marks: Array<{ type: string; attrs?: Record<string, unknown> }>;
}

// ─── Segment extraction ──────────────────────────────────────────────────────

function extractSegmentsFromNode(node: ProseMirrorNode): TextSegment[] {
  const out: TextSegment[] = [];

  // When the selection is within a single paragraph, doc.slice() returns a Fragment
  // whose top-level children ARE the text nodes (not the paragraph wrapping them).
  // We must handle this case before calling descendants() which returns nothing for
  // leaf text nodes.
  if (node.isText && node.text) {
    out.push({
      text: node.text,
      marks: node.marks.map((m) => ({
        type: m.type.name,
        attrs: m.attrs && Object.keys(m.attrs).length > 0 ? m.attrs : undefined,
      })),
    });
    return out;
  }

  node.descendants((n) => {
    if (n.isText && n.text) {
      out.push({
        text: n.text,
        marks: n.marks.map((m) => ({
          type: m.type.name,
          attrs: m.attrs && Object.keys(m.attrs).length > 0 ? m.attrs : undefined,
        })),
      });
    }
  });
  return out;
}

function extractSegmentsFromJson(node: JSONContent): TextSegment[] {
  if (node.type === 'text') {
    const text = (node.text ?? '').replace(/\n/g, ' ');
    if (!text) return [];
    const marks = (node.marks ?? []).map((m: Record<string, unknown>) => ({
      type: m.type as string,
      attrs: m.attrs as Record<string, unknown> | undefined,
    })).filter((m) => m.type);
    return [{ text, marks }];
  }
  return (node.content ?? []).flatMap((c) => extractSegmentsFromJson(c as JSONContent));
}

/**
 * Hydrates a markdown string into text segments via editor.markdown.parse().
 * **bold** becomes a Strong mark, not literal `**` characters.
 */
function hydrateMarkdownToSegments(editor: Editor, markdown: string): TextSegment[] {
  const ed = editor as unknown as {
    markdown?: { parse: (s: string) => ProseMirrorNode | JSONContent };
  };
  if (!ed.markdown?.parse) {
    return markdown ? [{ text: markdown.replace(/\n/g, ' '), marks: [] }] : [];
  }
  const parsed = ed.markdown.parse(markdown);
  if (!parsed) return [];
  if (typeof (parsed as ProseMirrorNode).descendants === 'function') {
    return extractSegmentsFromNode(parsed as ProseMirrorNode);
  }
  return extractSegmentsFromJson(parsed as JSONContent);
}

function getMarksForSpan(
  segments: TextSegment[],
  start: number,
  len: number,
): Array<{ type: string; attrs?: Record<string, unknown> }> {
  let pos = 0;
  const marks: Array<{ type: string; attrs?: Record<string, unknown> }> = [];
  const end = start + len;
  for (const seg of segments) {
    const segEnd = pos + seg.text.length;
    if (segEnd > start && pos < end) marks.push(...seg.marks);
    pos = segEnd;
  }
  return marks;
}

// ─── Apply diff ───────────────────────────────────────────────────────────────

/**
 * Applies a word-level inline diff to the editor within the given range.
 *
 * KEY BEHAVIOURS
 * ──────────────
 * 1. Single-block guard: the range must be within one block node (paragraph,
 *    heading, list item, etc.).  Cross-block replacements would destroy the
 *    block type — e.g. a heading would silently become a paragraph.
 *
 * 2. Hydrate-then-diff: the AI response is parsed by editor.markdown.parse()
 *    first so `**bold**` becomes a Strong mark, not literal asterisks.
 *
 * 3. changeId per hunk: consecutive add/remove chunks share a `changeId`
 *    (e.g. "h1", "h2").  These IDs are stored on the mark attrs so individual
 *    hunks can be accepted/rejected atomically via resolveInlineDiff().
 */
export function applyInlineDiff(
  editor: Editor,
  range: { from: number; to: number },
  _originalText: string,
  aiGeneratedText: string,
): { from: number; to: number } | null {
  if (!editor.schema.marks['addition'] || !editor.schema.marks['deletion']) return null;
  const docSize = editor.state.doc.content.size;
  if (range.from < 0 || range.to > docSize || range.from >= range.to) return null;

  // Guard: only apply within a single block node to preserve node type (headings, etc.)
  const $from = editor.state.doc.resolve(range.from);
  const $to = editor.state.doc.resolve(range.to);
  if ($from.parent !== $to.parent) return null;

  // Build segments for both sides
  const aiSegments = hydrateMarkdownToSegments(editor, aiGeneratedText);
  const aiPlain = aiSegments.map((s) => s.text).join('');

  const slice = editor.state.doc.slice(range.from, range.to);
  const originalSegments: TextSegment[] = [];
  slice.content.forEach((node) => originalSegments.push(...extractSegmentsFromNode(node)));
  const originalPlain = originalSegments.map((s) => s.text).join('');

  const rawChunks = diffWordsWithSpace(originalPlain, aiPlain).filter((c) => c.value.length > 0);
  if (rawChunks.length === 0) return null;

  // Assign changeId: consecutive add/remove blocks form one hunk and share an id
  let hunkCounter = 0;
  let inHunk = false;
  const chunks = rawChunks.map((c) => {
    if (c.added || c.removed) {
      if (!inHunk) { hunkCounter++; inHunk = true; }
      return { ...c, changeId: `h${hunkCounter}` };
    }
    inHunk = false;
    return { ...c, changeId: null };
  });

  let origPos = 0;
  let aiPos = 0;
  const jsonContent: JSONContent[] = [];

  for (const chunk of chunks) {
    const text = chunk.value.replace(/\n/g, ' ');
    if (!text) continue;

    const diffMarks: Array<{ type: string; attrs?: Record<string, unknown> }> = [];
    if (chunk.added)   diffMarks.push({ type: 'addition', attrs: { changeId: chunk.changeId } });
    if (chunk.removed) diffMarks.push({ type: 'deletion', attrs: { changeId: chunk.changeId } });

    // Carry over formatting marks (bold, italic, etc.) from the appropriate source
    const formatMarks = chunk.added
      ? getMarksForSpan(aiSegments, aiPos, text.length)
      : getMarksForSpan(originalSegments, origPos, text.length);

    // Deduplicate by mark type: ProseMirror throws if the same mark type appears
    // more than once on a node (e.g. two consecutive bold segments each contribute
    // a 'bold' mark when the diff word spans both, giving "bold,bold").
    const seenMarkTypes = new Set<string>();
    const allMarks = [...formatMarks, ...diffMarks].filter((m) => {
      if (seenMarkTypes.has(m.type)) return false;
      seenMarkTypes.add(m.type);
      return true;
    });
    jsonContent.push({ type: 'text', text, marks: allMarks.length > 0 ? allMarks : undefined });

    if (chunk.added) aiPos += text.length;
    else origPos += text.length;
  }

  const ok = editor.commands.insertContentAt(
    { from: range.from, to: range.to },
    jsonContent,
    { updateSelection: false, parseOptions: { preserveWhitespace: 'full' } },
  );
  if (!ok) return null;

  const totalLength = chunks.reduce((sum, c) => sum + c.value.length, 0);
  return { from: range.from, to: range.from + totalLength };
}

// ─── Shared resolution logic ──────────────────────────────────────────────────

function dispatchResolution(
  editor: Editor,
  action: 'accept' | 'reject',
  matchMark: (markName: string, changeId: string | null) => boolean,
): void {
  const { state } = editor;
  const additionMark = state.schema.marks['addition'];
  const deletionMark = state.schema.marks['deletion'];
  if (!additionMark || !deletionMark) return;

  const toDelete: Array<{ from: number; to: number }> = [];
  const toUnmark: Array<{ from: number; to: number; isAddition: boolean }> = [];

  state.doc.descendants((node, pos) => {
    if (!node.isText) return;
    for (const mark of node.marks) {
      const changeId = (mark.attrs?.changeId as string | null) ?? null;
      if (mark.type === additionMark && matchMark('addition', changeId)) {
        if (action === 'accept') toUnmark.push({ from: pos, to: pos + node.nodeSize, isAddition: true });
        else                     toDelete.push({ from: pos, to: pos + node.nodeSize });
      } else if (mark.type === deletionMark && matchMark('deletion', changeId)) {
        if (action === 'accept') toDelete.push({ from: pos, to: pos + node.nodeSize });
        else                     toUnmark.push({ from: pos, to: pos + node.nodeSize, isAddition: false });
      }
    }
  });

  const tr = state.tr;
  // Delete from end-to-start so earlier positions are not invalidated
  [...toDelete].sort((a, b) => b.from - a.from).forEach(({ from, to }) => tr.delete(from, to));
  toUnmark.forEach(({ from, to, isAddition }) => {
    const mf = tr.mapping.map(from);
    const mt = tr.mapping.map(to);
    if (mf < mt) tr.removeMark(mf, mt, isAddition ? additionMark : deletionMark);
  });
  editor.view.dispatch(tr);
}

// ─── Smart Dispatcher helpers ────────────────────────────────────────────────

/**
 * Returns true when the text contains block-level markdown that Tiptap needs
 * to parse natively: headings (`# …`), unordered lists (`- …`, `* …`, `+ …`),
 * ordered lists (`1. …`), or fenced code blocks (` ``` `).
 *
 * Plain prose (even with **bold** or _italic_) returns false, meaning
 * `applyInlineDiff` is safe to use.
 */
export function isStructuralMarkdown(text: string): boolean {
  const t = text.trim();
  return (
    /^#{1,6}\s+\S/m.test(t) ||   // headings
    /^[-*+]\s+\S/m.test(t) ||    // unordered list items
    /^\d+\.\s+\S/m.test(t) ||    // ordered list items
    /^```/m.test(t)               // fenced code blocks
  );
}

/**
 * Removes a leading heading line from AI-generated content so it is not
 * doubled when inserted into a section whose heading is already in the editor.
 *
 * e.g. "## General Assessment\n\nNew body…" → "New body…"
 * If no leading heading is present the text is returned unchanged.
 */
export function stripLeadingHeading(text: string): string {
  return text.replace(/^#{1,6}\s+[^\n]*\n?/, '').trimStart();
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Accept all inline diff marks in range. */
export function acceptInlineDiff(editor: Editor, range: { from: number; to: number }): void {
  const { state } = editor;
  const additionMark = state.schema.marks['addition'];
  const deletionMark = state.schema.marks['deletion'];
  if (!additionMark || !deletionMark) return;

  const toDelete: Array<{ from: number; to: number }> = [];
  const toUnmark: Array<{ from: number; to: number }> = [];

  state.doc.nodesBetween(range.from, range.to, (node, pos) => {
    if (!node.isText) return;
    if (node.marks.some((m) => m.type === deletionMark)) {
      toDelete.push({ from: pos, to: pos + node.nodeSize });
    } else if (node.marks.some((m) => m.type === additionMark)) {
      toUnmark.push({ from: pos, to: pos + node.nodeSize });
    }
  });

  const tr = state.tr;
  [...toDelete].sort((a, b) => b.from - a.from).forEach(({ from, to }) => tr.delete(from, to));
  toUnmark.forEach(({ from, to }) => {
    const mf = tr.mapping.map(from);
    const mt = tr.mapping.map(to);
    if (mf < mt) tr.removeMark(mf, mt, additionMark);
  });
  editor.view.dispatch(tr);
}

/** Reject all inline diff marks in range. */
export function rejectInlineDiff(editor: Editor, range: { from: number; to: number }): void {
  const { state } = editor;
  const additionMark = state.schema.marks['addition'];
  const deletionMark = state.schema.marks['deletion'];
  if (!additionMark || !deletionMark) return;

  const toDelete: Array<{ from: number; to: number }> = [];
  const toUnmark: Array<{ from: number; to: number }> = [];

  state.doc.nodesBetween(range.from, range.to, (node, pos) => {
    if (!node.isText) return;
    if (node.marks.some((m) => m.type === additionMark)) {
      toDelete.push({ from: pos, to: pos + node.nodeSize });
    } else if (node.marks.some((m) => m.type === deletionMark)) {
      toUnmark.push({ from: pos, to: pos + node.nodeSize });
    }
  });

  const tr = state.tr;
  [...toDelete].sort((a, b) => b.from - a.from).forEach(({ from, to }) => tr.delete(from, to));
  toUnmark.forEach(({ from, to }) => {
    const mf = tr.mapping.map(from);
    const mt = tr.mapping.map(to);
    if (mf < mt) tr.removeMark(mf, mt, deletionMark);
  });
  editor.view.dispatch(tr);
}

/**
 * Atomic: accept or reject a single change by its changeId.
 * Used by the per-hunk floating Accept/Reject buttons.
 */
export function resolveInlineDiff(
  editor: Editor,
  changeId: string,
  action: 'accept' | 'reject',
): void {
  dispatchResolution(editor, action, (_, id) => id === changeId);
}

/**
 * Global: accept or reject every inline diff change in the document.
 * Used by the Accept All / Reject All banner.
 */
export function resolveAllChanges(editor: Editor, action: 'accept' | 'reject'): void {
  dispatchResolution(editor, action, () => true);
}
