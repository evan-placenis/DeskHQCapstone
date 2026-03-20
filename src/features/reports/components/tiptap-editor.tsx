"use client";

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from '@tiptap/markdown' // You need to install this
import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { useEffect, useMemo, useState, useRef, forwardRef, useImperativeHandle, useCallback } from 'react'
import {
    extractOutline,
    outlineToString,
    extractActiveSection,
    extractSectionsByHeading,
    getPositionForInsertAnchor,
    getRangeForReplaceSection as getRangeForReplaceSectionImpl,
    type OutlineEntry,
    type ActiveSectionInfo,
    type InsertAnchor,
} from '@/features/reports/components/editor-context'

import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import TextAlign from '@tiptap/extension-text-align'

// 1. Import the component and ReactNodeViewRenderer
import { ReactNodeViewRenderer } from '@tiptap/react'
import Image from '@tiptap/extension-image'
import Audio from '@tiptap/extension-audio'
import { ReportImageComponent } from './report-image-component'
import { AdditionMark, DeletionMark } from './diff-marks'
import { computeDiffDocument } from './diff-utils'
import { applyInlineDiff, acceptInlineDiff, rejectInlineDiff, resolveInlineDiff, resolveAllChanges } from './inline-diff-utils'
import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Check, X, Heading as HeadingIcon, ChevronDown, AlignLeft, AlignCenter, AlignRight, AlignJustify, List, ListOrdered, Image as ImageIcon, FileAudio, Table2, Plus, Minus, Trash2, Columns, Rows } from 'lucide-react'


// 2. Customize the Image Extension
// We extend the official @tiptap/extension-image with:
//   - data-src attribute trick to prevent 404s when src is a UUID
//   - Custom NodeView (ReportImageComponent) to resolve UUIDs → signed Supabase URLs
//   - Legacy parseHTML support for older report formats
const CustomImageExtension = Image.extend({
    name: 'image',
    draggable: true,

    // 🔥 THE FIX: Aggressively force Tiptap to treat this as inline
    inline: true,
    group: 'inline',

    // Official @tiptap/markdown: helpers has renderChildren, indent, wrapInBlock — no escape.
    renderMarkdown: (node) => {
        const escapeAlt = (s: string) => String(s ?? '').replace(/\\/g, '\\\\').replace(/\]/g, '\\]');
        const escapeSrc = (s: string) => String(s ?? '').replace(/\\/g, '\\\\').replace(/\)/g, '\\)').replace(/\(/g, '\\(');
        const alt = escapeAlt(node.attrs?.alt ?? '');
        const src = escapeSrc(node.attrs?.src ?? '');
        return `![${alt}](${src})`;
    },

    addAttributes() {
        return {
            ...this.parent?.(),
            src: {
                default: null,
                // Look for data-src first (our safe storage), then src (legacy/standard)
                parseHTML: element => element.getAttribute('data-src') || element.getAttribute('src'),
            },
            alt: { default: null },
            title: { default: null },
        }
    },
    // Support parsing legacy report formats alongside standard <img> tags
    parseHTML() {
        return [
            { tag: 'img[data-src]' }, // Priority: Our custom HTML fallback
            { tag: 'img[src]' }, // Standard HTML fallback
            { tag: 'div[data-type="report-image"]' }, // Legacy support
            { tag: 'span[data-type="report-image"]' } // Catch any broken reports from our testing!
        ]
    },
    // This handles the HTML generation for BOTH the DOM and the HTML Table Fallback
    renderHTML({ HTMLAttributes }) {
        return ['img', {
            ...HTMLAttributes, 
            'data-type': 'report-image',
            'data-src': HTMLAttributes.src, // Store UUID safely
            'src': 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7' // Transparent pixel prevents 404
        }]
    },
    addNodeView() {
        return ReactNodeViewRenderer(ReportImageComponent)
    },
}).configure({
    allowBase64: true,
    inline: true,
})

/** Context from the editor for client-side AI edit (selection + markdown + range) */
export interface SelectionContext {
    /** Plain text of the selection (for display) */
    selection: string;
    /** Markdown of the selection (preserves **, _, etc.) – send this to the LLM */
    markdown: string;
    /** ProseMirror positions so we can replace by coordinates on accept */
    range: { from: number; to: number };
    surroundingContext: string;
    fullMarkdown: string;
}

export interface TiptapEditorHandle {
    getSelectionContext: () => SelectionContext | null;
    /** Replace the given range with new markdown (parsed and inserted). Use when accepting an AI edit. */
    replaceRange: (range: { from: number; to: number }, newMarkdown: string) => void;
    /** Insert markdown at a position (for structure-based insertion, no selection). */
    insertAtPosition: (pos: number, markdown: string) => void;
    /** Resolve structural anchor to ProseMirror position for insertion. */
    getInsertPositionForAnchor: (anchor: InsertAnchor) => number | null;
    /** Get range (from, to) for replacing a section by heading name. */
    getRangeForReplaceSection: (heading: string) => { from: number; to: number } | null;
    /** Collapse the selection so the next getSelectionContext() returns null (e.g. after using selection for an edit). */
    clearSelection: () => void;
    /** Map: returns the document outline (all headings) as structured entries */
    getDocumentOutline: () => OutlineEntry[];
    /** Map: returns the document outline as a plain-text string for system prompts */
    getDocumentOutlineString: () => string;
    /** Lens: returns the heading + markdown of the section the cursor is currently in */
    getActiveSection: () => ActiveSectionInfo | null;
    /** Tool helper: extract markdown for specific sections by heading name */
    getSectionsByHeading: (headings: string[]) => Record<string, string>;
    /** Tool helper: return the full document markdown */
    getFullMarkdown: () => string;
    /**
     * Applies a word-level inline diff to the editor at the given range.
     * Added words are marked green (addition), removed words are marked red
     * strikethrough (deletion). Returns the new range covering all diff nodes,
     * or null when the operation cannot be applied (e.g. multi-block selection).
     */
    applyInlineDiff: (
        range: { from: number; to: number },
        originalText: string,
        aiGeneratedText: string,
    ) => { from: number; to: number } | null;
    /** Accept all inline diff marks in range: deletes deletion-marked text, un-marks addition-marked text. */
    acceptInlineDiff: (range: { from: number; to: number }) => void;
    /** Reject all inline diff marks in range: deletes addition-marked text, un-marks deletion-marked text. */
    rejectInlineDiff: (range: { from: number; to: number }) => void;
    /** Atomic: accept or reject a single change by changeId. */
    resolveInlineDiff: (changeId: string, action: 'accept' | 'reject') => void;
    /** Global: accept or reject all inline diff changes in the document. */
    resolveAllChanges: (action: 'accept' | 'reject') => void;
    /**
     * Replace a range with new structural markdown and enter "pending structural
     * change" mode: the new blocks are highlighted green and a right-margin
     * ✓/✗ pill lets the user accept or reject the change.
     */
    proposeStructuralChange: (range: { from: number; to: number }, newMarkdown: string) => void;
    /** Commit the pending structural change (keep new content, remove highlight). */
    acceptStructuralChange: () => void;
    /** Discard the pending structural change (restore original markdown). */
    rejectStructuralChange: () => void;
    /** True when a structural proposal is waiting for the user to accept/reject. */
    hasPendingStructuralChange: () => boolean;
}

// ─── Structural diff ─────────────────────────────────────────────────────────

interface PendingStructural {
    from: number;
    to: number;
    oldMarkdown: string;
    /** Positions of the individual blocks that are new/changed (for targeted decoration). */
    changedRanges: Array<{ from: number; to: number }>;
}

/** ProseMirror plugin key — used to read/write structural-diff state via meta. */
const structuralDiffKey = new PluginKey<PendingStructural | null>('structuralDiff');

/**
 * Extension that handles STRUCTURAL changes (bullet lists, headings, code blocks).
 *
 * When `proposeStructuralChange()` is called, the new content is inserted into
 * the editor and the affected blocks are decorated with a green left border.
 * A right-margin pill (same style as inline-diff pill) shows ✓/✗ buttons.
 *
 * Accept → keep new content, remove decoration.
 * Reject → restore old markdown, remove decoration.
 *
 * Plugin state maps positions through transactions so the decoration stays
 * aligned even if the user makes other edits while the proposal is pending.
 */
function createStructuralDiffExtension(
    onAllClear: React.MutableRefObject<(() => void) | undefined>,
) {
    return Extension.create({
        name: 'structuralDiff',
        addProseMirrorPlugins() {
            const getEditor = () => this.editor;

            // Plugin 1: state + node decorations
            const statePlugin = new Plugin<PendingStructural | null>({
                key: structuralDiffKey,
                state: {
                    init: () => null,
                    apply(tr, prev) {
                        const meta = tr.getMeta(structuralDiffKey) as
                            | { action: 'propose'; from: number; to: number; oldMarkdown: string; changedRanges: Array<{ from: number; to: number }> }
                            | { action: 'clear' }
                            | undefined;
                        if (meta?.action === 'propose') {
                            return {
                                from: meta.from,
                                to: meta.to,
                                oldMarkdown: meta.oldMarkdown,
                                changedRanges: meta.changedRanges,
                            };
                        }
                        if (meta?.action === 'clear') return null;
                        // Map all positions through the transaction so decorations stay
                        // aligned when the user makes other edits while the proposal is pending.
                        if (prev && tr.docChanged) {
                            return {
                                from: tr.mapping.map(prev.from),
                                to: tr.mapping.map(prev.to),
                                oldMarkdown: prev.oldMarkdown,
                                changedRanges: prev.changedRanges.map((r) => ({
                                    from: tr.mapping.map(r.from),
                                    to: tr.mapping.map(r.to),
                                })),
                            };
                        }
                        return prev;
                    },
                },
                props: {
                    decorations(state) {
                        const pending = structuralDiffKey.getState(state);
                        if (!pending) return DecorationSet.empty;
                        const docSize = state.doc.content.size;

                        // Decorate only the individual changed blocks, not the whole range.
                        const decos: Decoration[] = [];
                        for (const r of pending.changedRanges) {
                            if (r.from >= r.to || r.to > docSize || r.from < 0) continue;
                            decos.push(
                                Decoration.node(r.from, r.to, {
                                    style:
                                        'background-color:#f0fdf4;' +
                                        'border-left:3px solid #16a34a;' +
                                        'padding-left:6px;' +
                                        'margin-left:-6px;' +
                                        'border-radius:0 2px 2px 0;',
                                }),
                            );
                        }
                        return DecorationSet.create(state.doc, decos);
                    },
                },
            });

            // Plugin 2: right-margin accept/reject overlay (same pattern as hunkWidgetExtension)
            const overlayPlugin = new Plugin({
                view(editorView) {
                    const overlay = document.createElement('div');
                    overlay.setAttribute('aria-hidden', 'true');
                    overlay.style.cssText =
                        'position:absolute;top:0;right:0;bottom:0;left:0;' +
                        'pointer-events:none;overflow:visible;z-index:21;';

                    const parent = editorView.dom.parentElement;
                    if (parent) {
                        if (getComputedStyle(parent).position === 'static') {
                            parent.style.position = 'relative';
                        }
                        parent.appendChild(overlay);
                    }

                    function render() {
                        while (overlay.firstChild) overlay.removeChild(overlay.firstChild);

                        const pending = structuralDiffKey.getState(editorView.state);
                        if (!pending) return;
                        const editor = getEditor();
                        if (!editor) return;

                        const { from, to, oldMarkdown } = pending;
                        const docSize = editorView.state.doc.content.size;
                        if (from >= to || to > docSize) return;

                        const parentEl = editorView.dom.parentElement;
                        if (!parentEl) return;
                        const parentRect = parentEl.getBoundingClientRect();

                        // Vertically centre on the MIDPOINT of the proposed range so the
                        // pill appears near the middle of the changed blocks rather than
                        // anchoring to the very top of a potentially long section.
                        const midRaw = Math.floor((from + to) / 2);
                        const safePos = Math.max(1, Math.min(midRaw, docSize - 1));
                        let coords: { top: number; bottom: number } | null = null;
                        try { coords = editorView.coordsAtPos(safePos); } catch { /* fall through */ }
                        // Fallback: try the start of the range if midpoint isn't a valid text pos
                        if (!coords) {
                            try { coords = editorView.coordsAtPos(Math.max(1, Math.min(from, docSize - 1))); } catch { return; }
                        }
                        if (!coords) return;

                        const top = coords.top - parentRect.top + parentEl.scrollTop;
                        const lineH = coords.bottom - coords.top;

                        const pill = document.createElement('div');
                        pill.style.cssText =
                            `position:absolute;right:4px;top:${top + lineH / 2}px;` +
                            'transform:translateY(-50%);' +
                            'display:inline-flex;gap:3px;align-items:center;' +
                            'background:white;border:1px solid #bbf7d0;border-radius:4px;' +
                            'padding:2px 4px;box-shadow:0 1px 3px rgba(0,0,0,.12);' +
                            'pointer-events:auto;user-select:none;';

                        // "Structure" label
                        const lbl = document.createElement('span');
                        lbl.textContent = 'Structure';
                        lbl.style.cssText =
                            'font-size:9px;color:#16a34a;font-weight:600;' +
                            'white-space:nowrap;padding-right:2px;';
                        pill.appendChild(lbl);

                        const mkBtn = (
                            label: string, title: string, bg: string, isAccept: boolean,
                        ) => {
                            const btn = document.createElement('button');
                            btn.type = 'button';
                            btn.textContent = label;
                            btn.title = title;
                            btn.style.cssText =
                                `font-size:10px;padding:1px 5px;height:16px;background:${bg};` +
                                'color:#fff;border:none;border-radius:3px;cursor:pointer;' +
                                'line-height:1;font-weight:600;';
                            btn.addEventListener('mousedown', (e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                // Clear plugin state first (stops decoration immediately)
                                editorView.dispatch(
                                    editorView.state.tr.setMeta(structuralDiffKey, { action: 'clear' }),
                                );
                                if (!isAccept) {
                                    // Reject: restore old content
                                    const currentTo = Math.min(to, editorView.state.doc.content.size);
                                    editor.commands.insertContentAt(
                                        { from, to: currentTo },
                                        oldMarkdown || ' ',
                                        { contentType: 'markdown', updateSelection: false },
                                    );
                                }
                                onAllClear.current?.();
                            });
                            return btn;
                        };

                        pill.appendChild(mkBtn('✓', 'Accept structural change', '#16a34a', true));
                        pill.appendChild(mkBtn('✗', 'Reject structural change', '#dc2626', false));
                        overlay.appendChild(pill);
                    }

                    return {
                        update() { render(); },
                        destroy() { overlay.remove(); },
                    };
                },
            });

            return [statePlugin, overlayPlugin];
        },
    });
}

// ─── Inline hunk widget ───────────────────────────────────────────────────────

/**
 * Extension that renders one Accept (✓) / Reject (✗) button pair per paragraph
 * that contains inline diff marks, positioned in the RIGHT MARGIN of the editor
 * so they never overlap text.
 *
 * Uses the ProseMirror plugin view() lifecycle + coordsAtPos() to place an
 * absolutely-positioned overlay sibling alongside the editor DOM — the same
 * technique Tiptap's BubbleMenu uses.  The overlay is destroyed on unmount.
 *
 * onAllClear is called (via a ref) when no diff marks remain, allowing the
 * parent to hide the global Accept All / Reject All banner.
 */
function createHunkWidgetExtension(onAllClear: React.MutableRefObject<(() => void) | undefined>) {
    return Extension.create({
        name: 'hunkWidget',
        addProseMirrorPlugins() {
            const getEditor = () => this.editor;

            return [
                new Plugin({
                    view(editorView) {
                        // Create an overlay div that lives BESIDE the editor (sibling of .ProseMirror).
                        // pointer-events:none on the overlay itself; individual buttons restore it.
                        const overlay = document.createElement('div');
                        overlay.setAttribute('aria-hidden', 'true');
                        overlay.style.cssText =
                            'position:absolute;top:0;right:0;bottom:0;left:0;' +
                            'pointer-events:none;overflow:visible;z-index:20;';

                        const parent = editorView.dom.parentElement;
                        if (parent) {
                            // Ensure the parent is a positioning context for our absolute overlay.
                            if (getComputedStyle(parent).position === 'static') {
                                parent.style.position = 'relative';
                            }
                            parent.appendChild(overlay);
                        }

                        // ── Shared helper: collect per-block diff info ───────────────────
                        type BlockEntry = { lastMarkPos: number; ids: Set<string> };

                        function collectBlocks(doc: ReturnType<typeof editorView.state.doc.type.schema.topNodeType.create>): Map<number, BlockEntry> {
                            const blocks = new Map<number, BlockEntry>();
                            (doc as any).descendants((node: any, pos: number) => {
                                if (!node.isText) return;
                                for (const mark of node.marks as any[]) {
                                    const n: string = mark.type.name;
                                    if (n !== 'addition' && n !== 'deletion') continue;
                                    const changeId: string | null = mark.attrs?.changeId ?? null;
                                    if (!changeId) continue;
                                    const $pos = (doc as any).resolve(pos);
                                    if ($pos.depth < 1) continue;
                                    const pd: number = $pos.depth - 1;
                                    const blockStart: number = $pos.start(pd);
                                    const markEnd: number = pos + node.nodeSize;
                                    const entry = blocks.get(blockStart);
                                    if (!entry) {
                                        blocks.set(blockStart, { lastMarkPos: markEnd, ids: new Set([changeId]) });
                                    } else {
                                        entry.ids.add(changeId);
                                        if (markEnd > entry.lastMarkPos) entry.lastMarkPos = markEnd;
                                    }
                                }
                            });
                            return blocks;
                        }

                        // ── Render buttons into the overlay ──────────────────────────────
                        function render() {
                            // Clear previous buttons
                            while (overlay.firstChild) overlay.removeChild(overlay.firstChild);

                            const editor = getEditor();
                            if (!editor) return;

                            const { state } = editorView;
                            const blocks = collectBlocks(state.doc as any);
                            if (blocks.size === 0) return;

                            const parentEl = editorView.dom.parentElement;
                            if (!parentEl) return;
                            const parentRect = parentEl.getBoundingClientRect();

                            blocks.forEach(({ lastMarkPos, ids }) => {
                                const safePos = Math.min(lastMarkPos, state.doc.content.size - 1);
                                let coords: { top: number; bottom: number } | null = null;
                                try { coords = editorView.coordsAtPos(Math.max(0, safePos)); } catch { return; }
                                if (!coords) return;

                                // Top relative to the parent element, corrected for its scroll.
                                const top = coords.top - parentRect.top + parentEl.scrollTop;
                                // Vertical midpoint of the line (coordsAtPos gives top of glyph)
                                const lineHeight = coords.bottom - coords.top;

                                const pill = document.createElement('div');
                                pill.style.cssText =
                                    `position:absolute;right:4px;` +
                                    `top:${top + lineHeight / 2}px;` +
                                    `transform:translateY(-50%);` +
                                    `display:inline-flex;gap:3px;align-items:center;` +
                                    `background:white;border:1px solid #e2e8f0;border-radius:4px;` +
                                    `padding:2px 4px;box-shadow:0 1px 3px rgba(0,0,0,.12);` +
                                    `pointer-events:auto;user-select:none;`;

                                const mkBtn = (label: string, title: string, bg: string, action: 'accept' | 'reject') => {
                                    const btn = document.createElement('button');
                                    btn.type = 'button';
                                    btn.textContent = label;
                                    btn.title = title;
                                    btn.style.cssText =
                                        `font-size:10px;padding:1px 5px;height:16px;background:${bg};` +
                                        `color:#fff;border:none;border-radius:3px;cursor:pointer;line-height:1;font-weight:600;`;
                                    btn.addEventListener('mousedown', (e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        ids.forEach((id) => resolveInlineDiff(editor, id, action));
                                        // Check if any diff marks remain and fire onAllClear if not
                                        let hasDiff = false;
                                        editor.state.doc.descendants((n) => {
                                            if (hasDiff) return false;
                                            if (n.marks?.some(
                                                (m) => m.type.name === 'addition' || m.type.name === 'deletion',
                                            )) hasDiff = true;
                                        });
                                        if (!hasDiff) onAllClear.current?.();
                                    });
                                    return btn;
                                };

                                pill.appendChild(mkBtn('✓', 'Accept changes in this paragraph', '#16a34a', 'accept'));
                                pill.appendChild(mkBtn('✗', 'Reject changes in this paragraph', '#dc2626', 'reject'));
                                overlay.appendChild(pill);
                            });
                        }

                        return {
                            update() { render(); },
                            destroy() { overlay.remove(); },
                        };
                    },
                }),
            ];
        },
    });
}

/** Extension that shows a persistent highlight for a pinned selection range (survives blur when user clicks into chat) */
function createPinnedHighlightExtension(getRange: () => { from: number; to: number } | null) {
    return Extension.create({
        name: 'pinnedHighlight',
        addProseMirrorPlugins() {
            return [
                new Plugin({
                    props: {
                        decorations(state) {
                            const range = getRange();
                            if (!range || range.from >= range.to) return null;
                            const { from, to } = range;
                            const docSize = state.doc.content.size;
                            if (from < 0 || to > docSize) return null;
                            const deco = Decoration.inline(from, to, { class: 'pinned-selection-highlight' });
                            return DecorationSet.create(state.doc, [deco]);
                        },
                    },
                }),
            ];
        },
    });
}

interface TiptapEditorProps {
    content: string; // This expects the Markdown string from your processNode
    editable?: boolean; //make everything editable
    onUpdate?: (newContent: string) => void;
    diffContent?: string | null; // New content to compare against (enables review mode)
    onAcceptDiff?: () => void; // Callback when user accepts the diff
    onRejectDiff?: () => void; // Callback when user rejects the diff
    /** Called when selection changes; used to pin selection so it survives blur (e.g. clicking into chat) */
    onSelectionChange?: (context: SelectionContext | null) => void;
    /** When set, show a persistent highlight at this range (e.g. when user selected text then clicked into chat) */
    pinnedSelectionRange?: { from: number; to: number } | null;
    /** Called after the last inline diff mark is resolved via a per-paragraph button (not the global banner). */
    onAllDiffChangesResolved?: () => void;
}

const SURROUNDING_CHARS = 500;

export const TiptapEditor = forwardRef<TiptapEditorHandle, TiptapEditorProps>(function TiptapEditor({
    content,
    editable = true,
    onUpdate,
    diffContent,
    onAcceptDiff,
    onRejectDiff,
    onSelectionChange,
    pinnedSelectionRange,
    onAllDiffChangesResolved,
}, ref) {
    // Store the original markdown when entering review mode to prevent infinite loops
    const originalMarkdownRef = useRef<string | null>(null);
    const [originalMarkdown, setOriginalMarkdown] = useState<string | null>(null);
    const isUpdatingRef = useRef(false);
    // Track the last markdown the editor emitted via onUpdate so we can distinguish
    // "echoed" content (parent passing back what we just sent) from genuine external updates.
    const lastEmittedMarkdownRef = useRef<string | null>(null);
    const imageFileInputRef = useRef<HTMLInputElement | null>(null);
    const audioFileInputRef = useRef<HTMLInputElement | null>(null);
    const pinnedRangeRef = useRef<{ from: number; to: number } | null>(null);
    pinnedRangeRef.current = pinnedSelectionRange ?? null;

    // Determine if we're in review mode
    const isReviewMode = !!diffContent;

    const pinnedHighlightExtension = useMemo(
        () => createPinnedHighlightExtension(() => pinnedRangeRef.current),
        [] // ref is stable; we update .current and dispatch to force re-render
    );

    // Keep a ref to onAllDiffChangesResolved so createHunkWidgetExtension never
    // needs to be recreated when the callback identity changes between renders.
    const onAllDiffChangesResolvedRef = useRef(onAllDiffChangesResolved);
    onAllDiffChangesResolvedRef.current = onAllDiffChangesResolved;

    // Hunk widget extension is stable — createHunkWidgetExtension uses this.editor
    // (bound by Tiptap at mount time) and the ref above for the callback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const hunkWidgetExtension = useMemo(() => createHunkWidgetExtension(onAllDiffChangesResolvedRef), []);

    // Structural diff extension shares the same onAllClear callback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const structuralDiffExtension = useMemo(() => createStructuralDiffExtension(onAllDiffChangesResolvedRef), []);

    const editor = useEditor({
        immediatelyRender: false,
        extensions: [
            StarterKit, // Handles Bold, Italic, Bullet Lists, History, etc.
            TextAlign.configure({
                types: ['heading', 'paragraph'],
            }),
            CustomImageExtension,
            Audio.configure({
                controls: true,
                preload: 'metadata',
                allowBase64: true,
            }),
            AdditionMark, // Add diff marks
            DeletionMark, // Add diff marks
            Markdown,   // <--- The Magic: Allows Tiptap to read/write Markdown
            // 2. Register Table (Configure it to allow resizing)
            Table.configure({
                resizable: false, // Disable resizing, this was causing issues with the table iamges not being displayed correctly
                HTMLAttributes: {
                    class: 'my-table-class',
                },
            }),
            TableRow,
            TableHeader,
            TableCell,
            pinnedHighlightExtension,
            hunkWidgetExtension,
            structuralDiffExtension,
        ],
        content: content,
        contentType: 'markdown',
        editable: editable && !isReviewMode, // Disable editing in review mode
        editorProps: {
            attributes: {
                class: `
                font-['Segoe_UI',_sans-serif] text-[13.3px] leading-normal
                prose max-w-none focus:outline-none min-h-[150px]

                prose-headings:font-bold prose-headings:text-slate-900 
                prose-headings:text-[13.3px] prose-headings:mb-2 prose-headings:mt-4

                prose-p:text-[13.3px] prose-p:text-slate-900 prose-p:my-1

                prose-ul:list-disc prose-ul:pl-6 [&_ul_li]:marker:text-black prose-ol:list-decimal prose-ol:pl-6 prose-li:text-[13.3px] prose-li:my-0 prose-li:pl-0

                [&_td]:align-top [&_th]:align-top
                
                [&_td]:w-1/2
                
                [&_td]:p-3 [&_th]:p-3

                [&_table]:border-collapse [&_table]:border [&_table]:border-slate-300 [&_table]:w-full
                [&_td]:border [&_td]:border-slate-300
                [&_th]:border [&_th]:border-slate-300 [&_th]:bg-white [&_th]:font-normal
            `.replace(/\s+/g, ' ').trim(),
            },
        },

        onUpdate: ({ editor }) => {
            // Don't update if we're in review mode OR if we're currently updating
            // This prevents the infinite loop
            if (isReviewMode || isUpdatingRef.current) return;

            // When user types, we extract the new Markdown
            const newMarkdown = editor.getMarkdown();
            // Track what we emitted so the content-sync effect can skip the echo
            lastEmittedMarkdownRef.current = newMarkdown;
            if (onUpdate) onUpdate(newMarkdown);
        },
    })

    // Capture original markdown when entering review mode (after editor is created)
    useEffect(() => {
        if (diffContent && editor && !originalMarkdownRef.current) {
            try {
                // Get the current markdown from the editor BEFORE applying diff
                const currentMarkdown = editor.getMarkdown();
                const original = currentMarkdown || content;
                originalMarkdownRef.current = original;
                setOriginalMarkdown(original); // Update state to trigger useMemo
            } catch (e) {
                // Fallback to content prop
                originalMarkdownRef.current = content;
                setOriginalMarkdown(content);
            }
        } else if (!diffContent) {
            // Reset when exiting review mode
            originalMarkdownRef.current = null;
            setOriginalMarkdown(null);
        }
    }, [diffContent, editor, content]);

    // Compute diff markdown when diffContent is provided
    // Returns a Markdown string with HTML span tags for diff marks
    const diffMarkdown = useMemo(() => {
        if (!diffContent) return null;
        const baseMarkdown = originalMarkdown || content;
        // Strip any HTML that might have leaked in
        const cleanBase = baseMarkdown.replace(/<[^>]*>/g, '').trim();
        const cleanDiff = diffContent.trim();
        return computeDiffDocument(cleanBase, cleanDiff);
    }, [diffContent, content, originalMarkdown]);

    // Update editor content when diffContent changes (review mode)
    useEffect(() => {
        if (!editor || !diffContent || !diffMarkdown || isUpdatingRef.current) return;

        isUpdatingRef.current = true;
        try {
            // Set the diff markdown content (with HTML spans)
            // Tiptap's Markdown extension will parse the Markdown and the HTML spans
            // The AdditionMark and DeletionMark extensions will parse the spans into marks
            if (diffMarkdown) {
                editor.commands.setContent(diffMarkdown, { contentType: 'markdown' });
            }
        } finally {
            // Reset the flag after update completes
            setTimeout(() => {
                isUpdatingRef.current = false;
            }, 200);
        }
    }, [diffContent, diffMarkdown, editor]);

    // Update editor content if the prop changes externally (e.g. from AI regeneration)
    // Skip this if we're in review mode OR if the incoming content is just an echo of
    // what the editor itself emitted (prevents the expensive serialize→setState→setContent loop).
    useEffect(() => {
        if (!editor || isReviewMode) return;

        // If the incoming content matches the last markdown we emitted via onUpdate,
        // this is just the parent echoing our own change back — skip the expensive re-parse.
        if (content === lastEmittedMarkdownRef.current) return;

        // Get current editor state
        let currentMarkdown = "";
        try {
            currentMarkdown = editor.getMarkdown();
        } catch (e) {
            console.warn("Tiptap storage not ready yet");
            return;
        }

        // Only apply if the incoming content is genuinely different from what's in the editor
        if (content && content !== currentMarkdown) {
            editor.commands.setContent(content, { contentType: 'markdown' });
        }
    }, [content, editor, isReviewMode]);

    // Force ProseMirror view to re-render when pinned range changes (so decoration appears/disappears)
    useEffect(() => {
        if (!editor) return;
        const tr = editor.state.tr.setMeta('addToHistory', false);
        editor.view.dispatch(tr);
    }, [editor, pinnedSelectionRange]);

    // Notify parent when selection changes so we can "pin" it (survives blur when user clicks into chat)
    useEffect(() => {
        if (!editor || !onSelectionChange || isReviewMode) return;
        const buildContext = (): SelectionContext | null => {
            const { from, to } = editor.state.selection;
            if (from === to) return null;
            const doc = editor.state.doc;
            const selection = doc.textBetween(from, to);
            if (!selection.trim()) return null;
            const size = doc.content.size;
            const before = doc.textBetween(0, from).slice(-SURROUNDING_CHARS);
            const after = doc.textBetween(to, size).slice(0, SURROUNDING_CHARS);
            let fullMarkdown = '';
            let markdown = '';
            try {
                fullMarkdown = editor.getMarkdown() ?? '';
                const slice = doc.slice(from, to);
                markdown = (editor as any).markdown?.serialize?.({ type: 'doc', content: slice.content.toJSON() }) ?? selection;
            } catch {
                return null;
            }
            return {
                selection,
                markdown: markdown || selection,
                range: { from, to },
                surroundingContext: before + (after ? '\n\n---\n\n' + after : ''),
                fullMarkdown,
            };
        };
        const handler = () => {
            const { from, to } = editor.state.selection;
            const hasSelection = from !== to && editor.state.doc.textBetween(from, to).trim().length > 0;
            if (hasSelection) {
                const ctx = buildContext();
                if (ctx) onSelectionChange(ctx);
            } else {
                // Only clear pinned selection when user cleared selection while still in editor (keeps selection when they blur to chat)
                if (editor.isFocused) onSelectionChange(null);
            }
        };
        editor.on('selectionUpdate', handler);
        return () => {
            editor.off('selectionUpdate', handler);
        };
    }, [editor, onSelectionChange, isReviewMode]);

    // Expose selection context and replaceRange for client-side AI edit (markdown in/out, range-based apply)
    useImperativeHandle(
        ref,
        () => ({
            getSelectionContext(): SelectionContext | null {
                if (!editor || isReviewMode) return null;
                const { from, to } = editor.state.selection;
                if (from === to) return null;
                const doc = editor.state.doc;
                const selection = doc.textBetween(from, to);
                if (!selection.trim()) return null;
                const size = doc.content.size;
                const before = doc.textBetween(0, from).slice(-SURROUNDING_CHARS);
                const after = doc.textBetween(to, size).slice(0, SURROUNDING_CHARS);
                let fullMarkdown = '';
                let markdown = '';
                try {
                    fullMarkdown = editor.getMarkdown() ?? '';
                    const slice = doc.slice(from, to);
                    markdown = (editor as any).markdown?.serialize?.({ type: 'doc', content: slice.content.toJSON() }) ?? selection;
                } catch {
                    return null;
                }
                return {
                    selection,
                    markdown: markdown || selection,
                    range: { from, to },
                    surroundingContext: before + (after ? '\n\n---\n\n' + after : ''),
                    fullMarkdown,
                };
            },
            replaceRange(range: { from: number; to: number }, newMarkdown: string) {
                if (!editor || isReviewMode) return;
                // Single insertContentAt call handles delete + insert atomically.
                // The two-step approach (deleteSelection → insertContentAt) was
                // bleeding into adjacent block nodes and deleting heading nodes.
                editor.commands.insertContentAt(
                    { from: range.from, to: range.to },
                    newMarkdown,
                    { contentType: 'markdown', updateSelection: false },
                );
            },
            insertAtPosition(pos: number, markdown: string) {
                if (!editor || isReviewMode) return;
                try {
                    editor.commands.insertContentAt(pos, markdown, { contentType: 'markdown' });
                } catch (e) {
                    console.warn("insertAtPosition failed:", e);
                }
            },
            getInsertPositionForAnchor(anchor: InsertAnchor) {
                if (!editor) return null;
                return getPositionForInsertAnchor(editor, anchor);
            },
            getRangeForReplaceSection(heading: string) {
                if (!editor) return null;
                return getRangeForReplaceSectionImpl(editor, heading);
            },
            clearSelection() {
                if (!editor || isReviewMode) return;
                const { from } = editor.state.selection;
                editor.commands.setTextSelection(from);
            },
            getDocumentOutline() {
                if (!editor) return [];
                return extractOutline(editor);
            },
            getDocumentOutlineString() {
                if (!editor) return '';
                return outlineToString(extractOutline(editor));
            },
            getActiveSection() {
                if (!editor) return null;
                return extractActiveSection(editor);
            },
            getSectionsByHeading(headings: string[]) {
                if (!editor) return {};
                return extractSectionsByHeading(editor, headings);
            },
            getFullMarkdown() {
                if (!editor) return '';
                try {
                    return editor.getMarkdown() ?? '';
                } catch {
                    return '';
                }
            },
            applyInlineDiff(range, originalText, aiGeneratedText) {
                if (!editor || isReviewMode) return null;
                return applyInlineDiff(editor, range, originalText, aiGeneratedText);
            },
            acceptInlineDiff(range) {
                if (!editor) return;
                acceptInlineDiff(editor, range);
            },
            rejectInlineDiff(range) {
                if (!editor) return;
                rejectInlineDiff(editor, range);
            },
            resolveInlineDiff(changeId, action) {
                if (!editor) return;
                resolveInlineDiff(editor, changeId, action);
            },
            resolveAllChanges(action) {
                if (!editor) return;
                resolveAllChanges(editor, action);
            },

            proposeStructuralChange(range: { from: number; to: number }, newMarkdown: string) {
                if (!editor || isReviewMode) return;

                // Auto-accept any previous pending structural change before proposing a new one.
                const existing = structuralDiffKey.getState(editor.state);
                if (existing) {
                    editor.view.dispatch(
                        editor.state.tr.setMeta(structuralDiffKey, { action: 'clear' }),
                    );
                }

                // Snapshot the text content of every textblock BEFORE insertion so we can
                // later identify which blocks are genuinely new or changed.
                const oldTextSet = new Set<string>();
                editor.state.doc.nodesBetween(range.from, range.to, (n) => {
                    if (n.isTextblock) oldTextSet.add(n.textContent);
                    return true;
                });

                // Capture old content as markdown so we can restore it on reject.
                let oldMarkdown = '';
                try {
                    const slice = editor.state.doc.slice(range.from, range.to);
                    oldMarkdown =
                        (editor as any).markdown?.serialize?.({
                            type: 'doc',
                            content: slice.content.toJSON(),
                        }) ?? '';
                } catch {
                    try {
                        oldMarkdown = editor.state.doc.textBetween(range.from, range.to);
                    } catch {
                        oldMarkdown = '';
                    }
                }

                // Record doc content size BEFORE the insertion so we can calculate the new range.
                const contentSizeBefore = editor.state.doc.content.size;

                // Apply the replacement atomically.
                editor.commands.insertContentAt(
                    { from: range.from, to: range.to },
                    newMarkdown,
                    { contentType: 'markdown', updateSelection: false },
                );

                // Calculate the end position of the newly inserted content.
                const contentSizeAfter = editor.state.doc.content.size;
                const newTo = range.to + (contentSizeAfter - contentSizeBefore);

                // Walk the new content and collect only the blocks that are new or changed.
                // For each changed textblock: if it lives inside a listItem, decorate the
                // listItem (so the bullet dot is highlighted too); otherwise decorate itself.
                const changedRanges: Array<{ from: number; to: number }> = [];
                const seenPos = new Set<number>();

                editor.state.doc.nodesBetween(range.from, newTo, (node, pos, parent) => {
                    if (!node.isTextblock) return true;
                    if (!oldTextSet.has(node.textContent)) {
                        let decorateFrom = pos;
                        let decorateTo = pos + node.nodeSize;
                        // Bubble up to listItem so the bullet/number indicator is also green.
                        // The paragraph is always the first child of a listItem, so the
                        // listItem's opening bracket is at pos-1.
                        if (parent?.type.name === 'listItem') {
                            decorateFrom = pos - 1;
                            decorateTo = decorateFrom + parent.nodeSize;
                        }
                        if (!seenPos.has(decorateFrom)) {
                            seenPos.add(decorateFrom);
                            changedRanges.push({ from: decorateFrom, to: decorateTo });
                        }
                    }
                    return false; // don't recurse into textblocks
                });

                // Fall back to decorating the whole range when nothing differed textually
                // (e.g. formatting-only change).
                const effectiveChangedRanges =
                    changedRanges.length > 0
                        ? changedRanges
                        : [{ from: range.from, to: newTo }];

                // Store in plugin state so positions are mapped through future transactions.
                editor.view.dispatch(
                    editor.state.tr.setMeta(structuralDiffKey, {
                        action: 'propose',
                        from: range.from,
                        to: newTo,
                        oldMarkdown,
                        changedRanges: effectiveChangedRanges,
                    }),
                );
            },

            acceptStructuralChange() {
                if (!editor) return;
                editor.view.dispatch(
                    editor.state.tr.setMeta(structuralDiffKey, { action: 'clear' }),
                );
            },

            rejectStructuralChange() {
                if (!editor || isReviewMode) return;
                const pending = structuralDiffKey.getState(editor.state);
                if (!pending) return;
                const { from, to, oldMarkdown } = pending;
                // Clear state first so the decoration disappears immediately.
                editor.view.dispatch(
                    editor.state.tr.setMeta(structuralDiffKey, { action: 'clear' }),
                );
                const currentTo = Math.min(to, editor.state.doc.content.size);
                editor.commands.insertContentAt(
                    { from, to: currentTo },
                    oldMarkdown || ' ',
                    { contentType: 'markdown', updateSelection: false },
                );
            },

            hasPendingStructuralChange() {
                if (!editor) return false;
                return structuralDiffKey.getState(editor.state) !== null;
            },
        }),
        [editor, isReviewMode]
    );

    const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            if (result && editor) {
                editor.chain().focus().setImage({ src: result, alt: file.name }).run();
            }
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    }, [editor]);

    const handleAudioSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !file.type.startsWith('audio/')) return;
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            if (result && editor) {
                editor.chain().focus().setAudio({
                    src: result,
                    controls: true,
                }).run();
            }
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    }, [editor]);

    if (!editor) return null;

    return (
        <div className="border border-slate-200 rounded-md p-4 bg-white shadow-sm relative">
            {/* Review Mode Banner */}
            {isReviewMode && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-blue-900">Review Mode</span>
                            <span className="text-xs text-blue-700">Comparing changes...</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={onRejectDiff}
                                className="h-8 text-xs hover:bg-red-50 hover:border-red-300 hover:text-red-700"
                            >
                                <X className="w-3 h-3 mr-1.5" />
                                Reject
                            </Button>
                            <Button
                                size="sm"
                                onClick={onAcceptDiff}
                                className="h-8 text-xs bg-green-600 hover:bg-green-700 text-white"
                            >
                                <Check className="w-3 h-3 mr-1.5" />
                                Accept Changes
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Simple Toolbar — sticky so it stays visible while scrolling */}
            {editable && !isReviewMode && (
                <div className="flex gap-2 mb-2 border-b border-slate-100 pb-2 sticky top-0 bg-white z-10 pt-1 -mt-1">
                    <button onClick={() => editor.chain().focus().toggleBold().run()} className="font-bold px-2 border rounded">B</button>
                    <button onClick={() => editor.chain().focus().toggleItalic().run()} className="italic px-2 border rounded">I</button>
                    <button
                        onClick={() => editor.chain().focus().toggleBulletList().run()}
                        className={`p-2 border rounded ${editor.isActive('bulletList') ? 'bg-slate-100 border-slate-300' : ''}`}
                        title="Bullet list"
                    >
                        <List className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => editor.chain().focus().toggleOrderedList().run()}
                        className={`p-2 border rounded ${editor.isActive('orderedList') ? 'bg-slate-100 border-slate-300' : ''}`}
                        title="Numbered list"
                    >
                        <ListOrdered className="w-4 h-4" />
                    </button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button
                                className={`px-2 border rounded flex items-center gap-1 ${editor.isActive('heading') ? 'bg-slate-100 border-slate-300' : ''}`}
                                title="Heading level"
                            >
                                <HeadingIcon className="w-4 h-4" />
                                <span>
                                    {editor.isActive('heading')
                                        ? `Heading ${editor.getAttributes('heading').level}`
                                        : 'Heading'}
                                </span>
                                <ChevronDown className="w-3.5 h-3.5 opacity-70" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                            <DropdownMenuItem
                                onClick={() => editor.chain().focus().setParagraph().run()}
                                className={!editor.isActive('heading') ? 'bg-slate-50 text-slate-600' : ''}
                            >
                                Paragraph
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                                className={editor.isActive('heading', { level: 1 }) ? 'bg-slate-50 text-slate-600' : ''}
                            >
                                Heading 1
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                                className={editor.isActive('heading', { level: 2 }) ? 'bg-slate-50 text-slate-600' : ''}
                            >
                                Heading 2
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                                className={editor.isActive('heading', { level: 3 }) ? 'bg-slate-50 text-slate-600' : ''}
                            >
                                Heading 3
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <span className="w-px bg-slate-200 self-stretch" aria-hidden />
                    <div className="flex items-center gap-0.5" role="group" aria-label="Text alignment">
                        <button
                            onClick={() => { editor.commands.focus(); editor.commands.setTextAlign('left'); }}
                            className={`p-2 border rounded ${editor.isActive('textAlign', { textAlign: 'left' }) ? 'bg-slate-100 border-slate-300' : ''}`}
                            title="Align left"
                        >
                            <AlignLeft className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => { editor.commands.focus(); editor.commands.setTextAlign('center'); }}
                            className={`p-2 border rounded ${editor.isActive('textAlign', { textAlign: 'center' }) ? 'bg-slate-100 border-slate-300' : ''}`}
                            title="Align center"
                        >
                            <AlignCenter className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => { editor.commands.focus(); editor.commands.setTextAlign('right'); }}
                            className={`p-2 border rounded ${editor.isActive('textAlign', { textAlign: 'right' }) ? 'bg-slate-100 border-slate-300' : ''}`}
                            title="Align right"
                        >
                            <AlignRight className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => { editor.commands.focus(); editor.commands.setTextAlign('justify'); }}
                            className={`p-2 border rounded ${editor.isActive('textAlign', { textAlign: 'justify' }) ? 'bg-slate-100 border-slate-300' : ''}`}
                            title="Justify"
                        >
                            <AlignJustify className="w-4 h-4" />
                        </button>
                    </div>
                    <span className="w-px bg-slate-200 self-stretch" aria-hidden />
                    <input
                        ref={imageFileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleImageSelect}
                    />
                    <button
                        onClick={() => imageFileInputRef.current?.click()}
                        className="p-2 border rounded"
                        title="Insert image"
                    >
                        <ImageIcon className="w-4 h-4" />
                    </button>
                    <input
                        ref={audioFileInputRef}
                        type="file"
                        accept="audio/*"
                        className="hidden"
                        onChange={handleAudioSelect}
                    />
                    <button
                        onClick={() => audioFileInputRef.current?.click()}
                        className="p-2 border rounded"
                        title="Insert audio"
                    >
                        <FileAudio className="w-4 h-4" />
                    </button>
                    <span className="w-px bg-slate-200 self-stretch" aria-hidden />
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button
                                className={`px-2 border rounded flex items-center gap-1 ${editor.isActive('table') ? 'bg-slate-100 border-slate-300' : ''}`}
                                title="Table"
                            >
                                <Table2 className="w-4 h-4" />
                                <span>Table</span>
                                <ChevronDown className="w-3.5 h-3.5 opacity-70" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="min-w-[180px]">
                            <DropdownMenuItem onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
                                <Plus className="w-4 h-4 mr-2" /> Insert Table (3×3)
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => editor.chain().focus().insertTable({ rows: 2, cols: 2, withHeaderRow: true }).run()}>
                                <Plus className="w-4 h-4 mr-2" /> Insert Table (2×2)
                            </DropdownMenuItem>
                            {editor.isActive('table') && (
                                <>
                                    <div className="h-px bg-slate-200 my-1" />
                                    <DropdownMenuItem onClick={() => editor.chain().focus().addRowBefore().run()}>
                                        <Rows className="w-4 h-4 mr-2" /> Add Row Above
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => editor.chain().focus().addRowAfter().run()}>
                                        <Rows className="w-4 h-4 mr-2" /> Add Row Below
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => editor.chain().focus().addColumnBefore().run()}>
                                        <Columns className="w-4 h-4 mr-2" /> Add Column Left
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => editor.chain().focus().addColumnAfter().run()}>
                                        <Columns className="w-4 h-4 mr-2" /> Add Column Right
                                    </DropdownMenuItem>
                                    <div className="h-px bg-slate-200 my-1" />
                                    <DropdownMenuItem onClick={() => editor.chain().focus().deleteRow().run()}>
                                        <Minus className="w-4 h-4 mr-2" /> Delete Row
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => editor.chain().focus().deleteColumn().run()}>
                                        <Minus className="w-4 h-4 mr-2" /> Delete Column
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => editor.chain().focus().mergeCells().run()}>
                                        <Table2 className="w-4 h-4 mr-2" /> Merge Cells
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => editor.chain().focus().splitCell().run()}>
                                        <Table2 className="w-4 h-4 mr-2" /> Split Cell
                                    </DropdownMenuItem>
                                    <div className="h-px bg-slate-200 my-1" />
                                    <DropdownMenuItem onClick={() => editor.chain().focus().deleteTable().run()} className="text-red-600 focus:text-red-600">
                                        <Trash2 className="w-4 h-4 mr-2" /> Delete Table
                                    </DropdownMenuItem>
                                </>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            )}
            <EditorContent editor={editor} />
        </div>
    );
});





// // OR just show a "Review Changes" modal before accepting.