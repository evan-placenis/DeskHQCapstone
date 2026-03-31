"use client";

import { useEditor, EditorContent } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from '@tiptap/markdown' // You need to install this
import { Extension, type Editor } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { useEffect, useLayoutEffect, useMemo, useState, useRef, forwardRef, useImperativeHandle, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
    extractOutline,
    outlineToString,
    extractActiveSection,
    extractSectionsByHeading,
    getPositionForInsertAnchor,
    getRangeForReplaceSection as getRangeForReplaceSectionImpl,
    type OutlineItem,
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
import {
    applyLibraryDiff as applyLibraryDiffImpl,
    resolveBlock as resolveBlockImpl,
    resolveAllChanges as resolveAllChangesImpl
} from './inline-diff-utils'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import type { PeerReviewComment } from '@/lib/types'
import { PeerReviewCommentMark, findTextRangeInDocument, findTextRangeInSingleNode } from './peer-review-comment-mark'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Check, X, Heading as HeadingIcon, ChevronDown, AlignLeft, AlignCenter, AlignRight, AlignJustify, List, ListOrdered, Image as ImageIcon, FileAudio, Table2, Plus, Minus, Trash2, Columns, Rows, MessageSquare, AlertCircle } from 'lucide-react'

function setsEqualString(a: Set<string>, b: Set<string>): boolean {
    if (a.size !== b.size) return false;
    for (const x of a) if (!b.has(x)) return false;
    return true;
}

/** After undo, original highlighted text reappears — clear "applied" for that suggestion. */
function reconcileAppliedPeerSuggestionIds(
    editor: Editor,
    peerReviewComments: PeerReviewComment[],
    appliedIds: Set<string>,
): Set<string> {
    const next = new Set(appliedIds);
    for (const id of appliedIds) {
        const c = peerReviewComments.find((x) => String(x.id) === String(id));
        if (!c || c.type !== "suggestion" || !c.highlightedText?.trim()) {
            next.delete(id);
            continue;
        }
        const doc = editor.state.doc;
        const range =
            findTextRangeInSingleNode(doc, c.highlightedText) ??
            findTextRangeInDocument(doc, c.highlightedText);
        if (!range) continue;
        const text = doc.textBetween(range.from, range.to);
        if (text.trim() === c.highlightedText.trim()) {
            next.delete(id);
        }
    }
    return next;
}

function PeerSuggestionApplyOverlays({
    editor,
    appliedPeerSuggestionIds,
    onApplyPeerSuggestion,
}: {
    editor: Editor | null;
    appliedPeerSuggestionIds: Set<string>;
    onApplyPeerSuggestion: (commentId: string | number) => void;
}) {
    const [boxes, setBoxes] = useState<Array<{ id: string; left: number; top: number }>>([]);

    const layout = useCallback(() => {
        if (!editor) return;
        const root = editor.view.dom.closest(".peer-review-editor-root");
        if (!root) return;
        const els = root.querySelectorAll(".review-comment--suggestion[data-comment-id]");
        const next: Array<{ id: string; left: number; top: number }> = [];
        els.forEach((el) => {
            const id = el.getAttribute("data-comment-id");
            if (!id) return;
            const r = el.getBoundingClientRect();
            next.push({
                id,
                left: r.right + 8,
                top: r.top + r.height / 2 - 8,
            });
        });
        setBoxes(next);
    }, [editor]);

    useLayoutEffect(() => {
        layout();
        const raf = () => requestAnimationFrame(layout);
        window.addEventListener("scroll", raf, true);
        window.addEventListener("resize", raf);
        const ro = new ResizeObserver(raf);
        if (editor?.view.dom) ro.observe(editor.view.dom);
        const mo = new MutationObserver(raf);
        if (editor?.view.dom) mo.observe(editor.view.dom, { subtree: true, childList: true });
        return () => {
            window.removeEventListener("scroll", raf, true);
            window.removeEventListener("resize", raf);
            ro.disconnect();
            mo.disconnect();
        };
    }, [editor, layout, appliedPeerSuggestionIds]);

    if (typeof document === "undefined") return null;

    return createPortal(
        <>
            {boxes.map((b) => {
                const applied = appliedPeerSuggestionIds.has(b.id);
                return (
                    <label
                        key={b.id}
                        className="pointer-events-auto fixed z-[10000] flex cursor-pointer items-center gap-1.5 rounded border border-green-600 bg-white px-1.5 py-0.5 text-[11px] font-medium text-green-900 shadow-md"
                        style={{ left: b.left, top: b.top }}
                    >
                        <input
                            type="checkbox"
                            className="h-3.5 w-3.5 rounded border-green-600"
                            checked={applied}
                            disabled={applied}
                            title={applied ? "Applied — undo (Ctrl+Z) to clear" : "Apply suggested text"}
                            aria-label="Apply peer suggestion"
                            onChange={(e) => {
                                if (e.target.checked && !applied) {
                                    onApplyPeerSuggestion(b.id);
                                }
                            }}
                        />
                        <span className="select-none">Apply</span>
                    </label>
                );
            })}
        </>,
        document.body,
    );
}

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
   
    // Diff Management
    applyLibraryDiff: (range: { from: number; to: number }, aiGeneratedMarkdown: string) => { from: number; to: number } | null;
    resolveInlineDiff: (blockStart: number, action: 'accept' | 'reject') => void;
    resolveAllChanges: (action: 'accept' | 'reject') => void;

    /** Find document range for plain text (e.g. peer-review highlighted span); same search as hydration. */
    findRangeForPlainText: (search: string) => { from: number; to: number } | null;

    // Tooling/Outline
    getDocumentOutline: () => OutlineItem[];
    getDocumentOutlineString: () => string;
    getActiveSection: () => ActiveSectionInfo | null;
    getSectionsByHeading: (headings: string[]) => Record<string, string>;
    getFullMarkdown: () => string;
    clearSelection: () => void;

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
/**
 * The consolidated Manager. Handles the green borders, the pills, and the logic.
 */
export function createChangeManagerExtension(
    onAllClear: React.MutableRefObject<(() => void) | undefined>
  ) {
    return Extension.create({
      name: 'changeManager',
      addProseMirrorPlugins() {
        const { editor } = this;
        return [
          new Plugin({
            key: new PluginKey('changeManager'),
            props: {
              // ... Your existing decorations() logic stays exactly the same ...
              decorations(state) {
                const decos: Decoration[] = [];
                state.doc.descendants((node, pos) => {
                  const hasDiff = node.marks?.some(m => m.type.name === 'addition' || m.type.name === 'deletion');
                  if (hasDiff) {
                    const $pos = state.doc.resolve(pos);
                    const blockStart = $pos.before(1);
                    const blockEnd = $pos.after(1);
                    decos.push(Decoration.node(blockStart, blockEnd, { class: 'diff-hunk-active' }));
                  }
                });
                return DecorationSet.create(state.doc, decos);
              },
            },
            view(editorView) {
              const overlay = document.createElement('div');
              overlay.className = 'tiptap-diff-overlay';
              // Note: Make sure editorView.dom.parentElement has 'position: relative' in its CSS!
              overlay.style.cssText = 'position:absolute;top:0;right:0;bottom:0;left:0;pointer-events:none;z-index:20;';
              editorView.dom.parentElement?.appendChild(overlay);
  
              const render = () => {
                overlay.innerHTML = '';
                const hunks = collectHunks(editorView.state.doc); 
                const overlayRect = overlay.getBoundingClientRect();
              
                hunks.forEach((blockStart) => {
                  const coords = editorView.coordsAtPos(blockStart);
                  if (!coords) return;
                  
                  const textCenterY = (coords.top + coords.bottom) / 2;
                  const relativeTop = textCenterY - overlayRect.top;
              
                  const pill = createPillElement(
                    [], // No longer need changeIds here
                    relativeTop, 
                    (action: 'accept' | 'reject') => {
                      // We pass the position of the block, not the ID!
                      resolveBlockImpl(editor, blockStart, action); 
                      
                      if (!docHasChanges(editor.state.doc)) onAllClear.current?.();
                    }
                  );
                  
                  overlay.appendChild(pill);
                });
              };
              
              return { update: render, destroy: () => overlay.remove() };
            }
          })
        ];
      }
    });
  }
  function collectHunks(doc: any): number[] {
    const hunkStarts = new Set<number>();
    
    doc.descendants((node: any, pos: number) => {
      if (!node.isText) return;
      
      const hasDiff = node.marks?.some((m: any) => m.type.name === 'addition' || m.type.name === 'deletion');
      if (hasDiff) {
        const $pos = doc.resolve(pos);
        // depth 1 gets the top-level block (Paragraph, Table, BulletList)
        hunkStarts.add($pos.before(1));
      }
    });
  
    return Array.from(hunkStarts);
  }

  

/** Creates the floating Accept/Reject pill element for a diff hunk. */
function createPillElement(
    changeIds: string[], // Keeping this in case you want to show a count later
    top: number,
    onAction: (action: 'accept' | 'reject') => void,
  ): HTMLElement {
    const pill = document.createElement('div');
    
    // Added 'pointer-events-auto' so it's clickable inside the transparent overlay
    pill.className = 'flex items-center gap-1 px-1.5 py-1 rounded border border-slate-200 bg-white shadow-sm pointer-events-auto';
    
    // Using transform: translateY(-50%) makes the vertical alignment much more forgiving
    pill.style.cssText = `position:absolute;top:${top}px;right:8px;z-index:30;transform:translateY(-50%);`;
  
    const mkBtn = (label: 'accept' | 'reject', icon: string, colorClass: string) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.innerHTML = icon;
      btn.title = label.charAt(0).toUpperCase() + label.slice(1);
      btn.className = `p-1 rounded transition-colors ${colorClass}`;
      
      // Prevent the editor from losing focus or moving the cursor on click
      btn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        onAction(label);
      });
      
      return btn;
    };
  
    const checkIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';
    const xIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
  
    pill.appendChild(mkBtn('accept', checkIcon, 'hover:bg-green-50 text-green-600'));
    pill.appendChild(mkBtn('reject', xIcon, 'hover:bg-red-50 text-red-600'));
  
    return pill;
  }
  
function docHasChanges(doc: any) {
let hasChanges = false;
doc.descendants((node: any) => {
    if (node.marks?.some((m: any) => m.type.name === 'addition' || m.type.name === 'deletion')) {
    hasChanges = true;
    return false;
    }
});
return hasChanges;
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
    /** Called when doc has unresolved diff marks (addition/deletion). Used for external banners; responds to Undo. */
    onHasUnresolvedEditsChange?: (hasEdits: boolean) => void;

    /** Peer review: read-only body + BubbleMenu to leave comments as a TipTap mark */
    peerReviewMode?: boolean;
    sectionId?: string | number;
    peerReviewComments?: PeerReviewComment[];
    activePeerReviewCommentId?: number | string | null;
    onPeerReviewHighlightComment?: (
        highlightedText: string,
        sectionId: string | number,
        comment: string,
        type: "issue" | "suggestion" | "comment"
    ) => void | Promise<void | { id: string | number } | null>;
    onPeerReviewCommentMarkClick?: (commentId: number | string) => void;
    /** Peer suggestion: parent replaces highlight via replaceRange (direct apply, no diff UI). */
    onApplyPeerSuggestion?: (commentId: number | string) => void;
    /** Suggestion IDs already applied (checked); parent owns state for panel + overlay sync. */
    appliedPeerSuggestionIds?: Set<string>;
    onAppliedPeerSuggestionIdsChange?: (next: Set<string>) => void;
}

const EMPTY_PEER_APPLIED = new Set<string>();

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
    onHasUnresolvedEditsChange,
    peerReviewMode = false,
    sectionId = "main-content",
    peerReviewComments = [],
    activePeerReviewCommentId = null,
    onPeerReviewHighlightComment,
    onPeerReviewCommentMarkClick,
    onApplyPeerSuggestion,
    appliedPeerSuggestionIds = EMPTY_PEER_APPLIED,
    onAppliedPeerSuggestionIdsChange,
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

    const [hasUnresolvedEdits, setHasUnresolvedEdits] = useState(false);

    // Determine if we're in review mode
    const isReviewMode = !!diffContent;

    const isReviewModeRef = useRef(isReviewMode);
    isReviewModeRef.current = isReviewMode;
    const peerReviewModeRef = useRef(peerReviewMode);
    peerReviewModeRef.current = peerReviewMode;

    /** Draft lives in the DOM (uncontrolled) so typing doesn't re-render the editor on every keypress. */
    const peerCommentDraftRef = useRef<HTMLTextAreaElement>(null);
    const [peerCommentBubbleKey, setPeerCommentBubbleKey] = useState(0);
    const [peerCommentType, setPeerCommentType] = useState<"comment" | "suggestion" | "issue">("comment");
    const [peerCommentSubmitting, setPeerCommentSubmitting] = useState(false);
    const peerCommentsRef = useRef(peerReviewComments);
    peerCommentsRef.current = peerReviewComments;

    /** Floating tooltip for hover on review highlights (text only; apply uses fixed overlay checkboxes). */
    const [peerHoverTip, setPeerHoverTip] = useState<{
        text: string;
        type: "comment" | "suggestion" | "issue";
        left: number;
        top: number;
    } | null>(null);

    const appliedPeerSuggestionIdsRef = useRef(appliedPeerSuggestionIds);
    appliedPeerSuggestionIdsRef.current = appliedPeerSuggestionIds;

    // 1. Refs for parent callbacks
    const onAllDiffChangesResolvedRef = useRef(onAllDiffChangesResolved);
    onAllDiffChangesResolvedRef.current = onAllDiffChangesResolved;
    const onHasUnresolvedEditsChangeRef = useRef(onHasUnresolvedEditsChange);
    onHasUnresolvedEditsChangeRef.current = onHasUnresolvedEditsChange;

    // 2. Stable extension definitions
    const pinnedHighlightExtension = useMemo(() => createPinnedHighlightExtension(() => pinnedRangeRef.current), []);
    const changeManagerExtension = useMemo(() => createChangeManagerExtension(onAllDiffChangesResolvedRef), []);

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
            PeerReviewCommentMark,
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
            changeManagerExtension,
        ],
        content: content,
        contentType: 'markdown',
        editable: editable && !isReviewMode, // Diff review = read-only; peer-review can edit (undo)
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
            // Don't update if we're in diff review mode or if we're currently updating (peer-review edits propagate)
            if (isReviewModeRef.current || isUpdatingRef.current) return;

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

    // Track unresolved changes for the UI banner (Instant Undo, Debounced Typing)
    useEffect(() => {
        if (!editor) return;

        let timeoutId: NodeJS.Timeout;

        const updateUI = ({ transaction }: { transaction: any }) => {
            // 1. If nothing changed in the doc, ignore it (selection/cursor moves)
            if (!transaction.docChanged) return;

            // 2. Check if this is an Undo/Redo
            const isHistoryOp = !!transaction.getMeta('history$');

            const performCheck = () => {
                const hasEdits = docHasChanges(editor.state.doc);
                setHasUnresolvedEdits(hasEdits);
                onHasUnresolvedEditsChangeRef.current?.(hasEdits);
            };

            if (isHistoryOp) {
                // ⚡️ INSTANT: Undo/Redo needs to feel snappy
                clearTimeout(timeoutId);
                performCheck();
            } else {
                // ⏳ DEBOUNCED: Typing is "dirty" work—wait for a pause
                clearTimeout(timeoutId);
                timeoutId = setTimeout(performCheck, 150);
            }
        };

        // Run once on mount to catch initial diffs
        setHasUnresolvedEdits(docHasChanges(editor.state.doc));

        editor.on('transaction', updateUI);

        return () => {
            editor.off('transaction', updateUI);
            clearTimeout(timeoutId);
        };
    }, [editor]);

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

    // Keep read-only in sync when diff / peer-review toggles (useEditor only reads initial editable)
    useEffect(() => {
        if (!editor) return;
        editor.setEditable(editable && !isReviewMode);
    }, [editor, editable, isReviewMode]);

    // Update editor content if the prop changes externally (e.g. from AI regeneration)
    // Skip this if we're in diff review mode OR if the incoming content is just an echo of
    // what the editor itself emitted (prevents the expensive serialize→setState→setContent loop).
    // In peer-review mode, still skip external sync so hydration/peer marks are not overwritten;
    // user edits rely on onUpdate + lastEmittedMarkdownRef echo check.
    useEffect(() => {
        if (!editor || isReviewMode || peerReviewMode) return;

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
    }, [content, editor, isReviewMode, peerReviewMode]);

    useEffect(() => {
        if (!editor || !peerReviewMode) return;

        isUpdatingRef.current = true;
        try {
            for (const c of peerReviewComments ?? []) {
                if (!c.highlightedText) continue;
                if (String(c.sectionId ?? "") !== String(sectionId ?? "")) continue;

                const range =
                    findTextRangeInSingleNode(editor.state.doc, c.highlightedText) ??
                    findTextRangeInDocument(editor.state.doc, c.highlightedText);
                if (!range) continue;

                const markType = editor.schema.marks.peerReviewComment;
                if (!markType) continue;

                let already = false;
                editor.state.doc.nodesBetween(range.from, range.to, (node) => {
                    if (node.marks?.some((m) => m.type === markType && String(m.attrs.commentId) === String(c.id))) {
                        already = true;
                    }
                });
                const wantResolved = c.resolved ? "true" : "false";
                if (already) {
                    let needsAttrSync = false;
                    editor.state.doc.nodesBetween(range.from, range.to, (node) => {
                        const m = node.marks?.find(
                            (mk) =>
                                mk.type === markType && String(mk.attrs.commentId) === String(c.id)
                        );
                        if (
                            m &&
                            (String(m.attrs.resolved) !== wantResolved ||
                                String(m.attrs.commentType || "comment") !== c.type)
                        ) {
                            needsAttrSync = true;
                        }
                    });
                    if (needsAttrSync) {
                        editor
                            .chain()
                            .setTextSelection({ from: range.from, to: range.to })
                            .setMark("peerReviewComment", {
                                commentId: String(c.id),
                                commentType: c.type,
                                resolved: wantResolved,
                            })
                            .run();
                    }
                    continue;
                }

                editor
                    .chain()
                    .setTextSelection({ from: range.from, to: range.to })
                    .setMark("peerReviewComment", {
                        commentId: String(c.id),
                        commentType: c.type,
                        resolved: wantResolved,
                    })
                    .run();
            }
        } finally {
            isUpdatingRef.current = false;
        }
    }, [editor, peerReviewMode, peerReviewComments, sectionId, content]);

    /** Remove peer-review marks for comments no longer in the list (e.g. deleted from server). */
    useEffect(() => {
        if (!editor || !peerReviewMode) return;
        const markType = editor.schema.marks.peerReviewComment;
        if (!markType) return;
        const validIds = new Set((peerReviewComments ?? []).map((c) => String(c.id)));
        const ranges: { from: number; to: number }[] = [];
        editor.state.doc.descendants((node, pos) => {
            if (!node.isText || !node.text) return;
            const m = node.marks.find((mk) => mk.type === markType);
            if (!m || m.attrs.commentId == null) return;
            const cid = String(m.attrs.commentId);
            if (!validIds.has(cid)) {
                ranges.push({ from: pos, to: pos + node.text.length });
            }
        });
        if (ranges.length === 0) return;
        ranges.sort((a, b) => b.from - a.from);
        isUpdatingRef.current = true;
        try {
            let tr = editor.state.tr;
            for (const { from, to } of ranges) {
                tr = tr.removeMark(from, to, markType);
            }
            if (tr.steps.length) editor.view.dispatch(tr);
        } finally {
            isUpdatingRef.current = false;
        }
    }, [editor, peerReviewMode, peerReviewComments]);

    // Highlight the comment span that matches the active panel selection (re-run after doc changes)
    useEffect(() => {
        if (!editor || !peerReviewMode) return;
        const syncActiveClass = () => {
            const root = editor.view.dom;
            root.querySelectorAll(".review-comment[data-comment-id]").forEach((el) => {
                const id = el.getAttribute("data-comment-id");
                const match =
                    activePeerReviewCommentId != null &&
                    id != null &&
                    String(activePeerReviewCommentId) === String(id);
                const t = el.getAttribute("data-comment-type") || "comment";
                const typeClass =
                    t === "issue"
                        ? "peer-review-comment-active--issue"
                        : t === "suggestion"
                          ? "peer-review-comment-active--suggestion"
                          : "peer-review-comment-active--comment";
                el.classList.remove(
                    "peer-review-comment-active--issue",
                    "peer-review-comment-active--suggestion",
                    "peer-review-comment-active--comment"
                );
                if (match) el.classList.add(typeClass);
            });
        };
        syncActiveClass();
        editor.on("update", syncActiveClass);
        return () => {
            editor.off("update", syncActiveClass);
        };
    }, [editor, peerReviewMode, activePeerReviewCommentId]);

    // Click .review-comment → sync active comment with side panel
    useEffect(() => {
        if (!editor || !peerReviewMode || !onPeerReviewCommentMarkClick) return;
        const dom = editor.view.dom;
        const onClick = (e: MouseEvent) => {
            const el = (e.target as HTMLElement)?.closest?.(".review-comment[data-comment-id]");
            if (!el) return;
            const id = el.getAttribute("data-comment-id");
            if (!id) return;
            onPeerReviewCommentMarkClick(id);
        };
        dom.addEventListener("click", onClick);
        return () => dom.removeEventListener("click", onClick);
    }, [editor, peerReviewMode, onPeerReviewCommentMarkClick]);

    // Hover tooltip: show full review text (lookup by comment id)
    useEffect(() => {
        if (!editor || !peerReviewMode) return;
        const root = editor.view.dom;
        let lastEl: HTMLElement | null = null;

            const onMove = (e: MouseEvent) => {
            const el = (e.target as HTMLElement)?.closest?.(
                ".review-comment[data-comment-id]"
            ) as HTMLElement | null;
            if (!el) {
                if (lastEl) {
                    lastEl = null;
                    setPeerHoverTip(null);
                }
                return;
            }
            const id = el.getAttribute("data-comment-id");
            const c = peerCommentsRef.current.find((x) => String(x.id) === String(id));
            if (!c?.comment) {
                setPeerHoverTip(null);
                return;
            }
            const r = el.getBoundingClientRect();
            const next = {
                text: c.comment,
                type: c.type,
                left: r.left + r.width / 2,
                top: r.bottom + 8,
            };
            if (el === lastEl) {
                setPeerHoverTip((prev) => (prev ? { ...prev, ...next } : next));
                return;
            }
            lastEl = el;
            setPeerHoverTip(next);
        };

        const onLeave = (e: MouseEvent) => {
            const to = e.relatedTarget as Node | null;
            if (to && root.contains(to)) return;
            lastEl = null;
            setPeerHoverTip(null);
        };

        root.addEventListener("mousemove", onMove);
        root.addEventListener("mouseleave", onLeave);
        return () => {
            root.removeEventListener("mousemove", onMove);
            root.removeEventListener("mouseleave", onLeave);
            setPeerHoverTip(null);
        };
    }, [editor, peerReviewMode]);

    /** Undo restores highlighted text — uncheck "applied" for that suggestion. */
    useEffect(() => {
        if (!editor || !peerReviewMode || !onAppliedPeerSuggestionIdsChange) return;
        const onTr = ({ transaction }: { transaction: import("@tiptap/pm/state").Transaction }) => {
            if (!transaction.docChanged) return;
            const applied = appliedPeerSuggestionIdsRef.current;
            if (applied.size === 0) return;
            queueMicrotask(() => {
                const next = reconcileAppliedPeerSuggestionIds(
                    editor,
                    peerCommentsRef.current,
                    applied,
                );
                if (!setsEqualString(next, applied)) {
                    onAppliedPeerSuggestionIdsChange(next);
                }
            });
        };
        editor.on("transaction", onTr);
        return () => {
            editor.off("transaction", onTr);
        };
    }, [editor, peerReviewMode, onAppliedPeerSuggestionIdsChange]);

    // Force ProseMirror view to re-render when pinned range changes (so decoration appears/disappears)
    useEffect(() => {
        if (!editor) return;
        const tr = editor.state.tr.setMeta('addToHistory', false);
        editor.view.dispatch(tr);
    }, [editor, pinnedSelectionRange]);

    // Notify parent when selection changes so we can "pin" it (survives blur when user clicks into chat)
    useEffect(() => {
        if (!editor || !onSelectionChange || isReviewMode || peerReviewMode) return;
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
    }, [editor, onSelectionChange, isReviewMode, peerReviewMode]);

    const submitPeerReviewComment = useCallback(async () => {
        if (!editor || !onPeerReviewHighlightComment) return;
        const { from, to } = editor.state.selection;
        if (from === to) return;
        const rangeFrom = from;
        const rangeTo = to;
        const highlightedText = editor.state.doc.textBetween(from, to).trim();
        const body = peerCommentDraftRef.current?.value?.trim() ?? "";
        if (!highlightedText || !body) return;
        setPeerCommentSubmitting(true);
        try {
            const saved = await Promise.resolve(
                onPeerReviewHighlightComment(highlightedText, sectionId, body, peerCommentType)
            );
            const newId =
                saved && typeof saved === "object" && saved.id != null ? String(saved.id) : null;
            if (newId && editor) {
                editor
                    .chain()
                    .setTextSelection({ from: rangeFrom, to: rangeTo })
                    .setMark("peerReviewComment", {
                        commentId: newId,
                        commentType: peerCommentType,
                        resolved: "false",
                    })
                    .run();
            }
            if (peerCommentDraftRef.current) peerCommentDraftRef.current.value = "";
            setPeerCommentBubbleKey((k) => k + 1);
        } catch (e) {
            console.error(e);
        } finally {
            setPeerCommentSubmitting(false);
        }
    }, [editor, onPeerReviewHighlightComment, peerCommentType, sectionId]);

    // Expose selection context and replaceRange for client-side AI edit (markdown in/out, range-based apply)
    useImperativeHandle(
        ref,
        () => ({
            getSelectionContext(): SelectionContext | null {
                if (!editor || isReviewMode || peerReviewMode) return null;
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
                if (!editor || isReviewMode || peerReviewMode) return;
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
                if (!editor || isReviewMode || peerReviewMode) return;
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
            applyLibraryDiff(
                range: { from: number; to: number },
                aiGeneratedMarkdown: string,
            ) {
                if (!editor || isReviewMode) return null;
                return applyLibraryDiffImpl(editor, range, aiGeneratedMarkdown);
            },
            findRangeForPlainText(search: string) {
                if (!editor || !search?.trim()) return null;
                const doc = editor.state.doc;
                return (
                    findTextRangeInSingleNode(doc, search) ?? findTextRangeInDocument(doc, search)
                );
            },
            resolveInlineDiff(blockStart: number, action: 'accept' | 'reject') {
                if (!editor) return;
                resolveBlockImpl(editor, blockStart, action);
            },
            resolveAllChanges(action: 'accept' | 'reject') {
                if (!editor) return;
                resolveAllChangesImpl(editor, action);
            },
        }),
        [editor, isReviewMode, peerReviewMode]
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
        <div className="border border-slate-200 rounded-md p-4 bg-white shadow-sm relative peer-review-editor-root">
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
                                Accept
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

            {peerReviewMode && (
                <BubbleMenu
                    editor={editor}
                    options={{
                        placement: "top",
                        offset: 8,
                    }}
                    shouldShow={({ editor: ed, state }) => {
                        if (!onPeerReviewHighlightComment) return false;
                        const { from, to } = state.selection;
                        if (from === to) return false;
                        return ed.state.doc.textBetween(from, to).trim().length > 0;
                    }}
                >
                    <div
                        className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 shadow-xl w-[min(92vw,680px)] min-w-[min(92vw,520px)] max-w-[680px]"
                        onMouseDown={(e) => e.stopPropagation()}
                    >
                        <p className="text-xs font-medium text-slate-600">Leave a review comment</p>
                        <div className="flex gap-1">
                            <Button
                                type="button"
                                size="sm"
                                variant={peerCommentType === "comment" ? "default" : "outline"}
                                className="h-7 flex-1 text-xs"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => setPeerCommentType("comment")}
                            >
                                <MessageSquare className="w-3 h-3 mr-1" />
                                Comment
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant={peerCommentType === "suggestion" ? "default" : "outline"}
                                className="h-7 flex-1 text-xs"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => setPeerCommentType("suggestion")}
                            >
                                Suggest
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant={peerCommentType === "issue" ? "default" : "outline"}
                                className="h-7 flex-1 text-xs"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => setPeerCommentType("issue")}
                            >
                                <AlertCircle className="w-3 h-3 mr-1" />
                                Issue
                            </Button>
                        </div>
                        <Textarea
                            key={peerCommentBubbleKey}
                            ref={peerCommentDraftRef}
                            placeholder="Your feedback…"
                            defaultValue=""
                            rows={4}
                            className="min-h-[88px] max-h-[160px] text-sm resize-y"
                            onInput={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                            disabled={peerCommentSubmitting}
                        />
                        <Button
                            type="button"
                            size="sm"
                            className="w-full bg-theme-primary hover:bg-theme-primary-hover text-white"
                            disabled={peerCommentSubmitting}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => void submitPeerReviewComment()}
                        >
                            {peerCommentSubmitting ? "Saving…" : `Add ${peerCommentType}`}
                        </Button>
                    </div>
                </BubbleMenu>
            )}

            <EditorContent editor={editor} />

            {peerReviewMode && onApplyPeerSuggestion && (
                <PeerSuggestionApplyOverlays
                    editor={editor}
                    appliedPeerSuggestionIds={appliedPeerSuggestionIds}
                    onApplyPeerSuggestion={onApplyPeerSuggestion}
                />
            )}

            {peerHoverTip &&
                typeof document !== "undefined" &&
                createPortal(
                    <div
                        role="tooltip"
                        className={`pointer-events-none fixed z-[9999] max-w-sm -translate-x-1/2 rounded-md border px-3 py-2 text-sm shadow-lg ${
                            peerHoverTip.type === "issue"
                                ? "border-red-400 bg-red-50 text-red-950"
                                : peerHoverTip.type === "suggestion"
                                  ? "border-green-600 bg-green-50 text-green-950"
                                  : "border-blue-600 bg-blue-50 text-blue-950"
                        }`}
                        style={{
                            left: peerHoverTip.left,
                            top: peerHoverTip.top,
                        }}
                    >
                        <p className="whitespace-pre-wrap">{peerHoverTip.text}</p>
                    </div>,
                    document.body
                )}
        </div>
    );
});





// // OR just show a "Review Changes" modal before accepting.