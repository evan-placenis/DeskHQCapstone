"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import { useEffect, useLayoutEffect, useMemo, useState, useRef, forwardRef, useImperativeHandle, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  extractOutline,
  outlineToString,
  extractActiveSection,
  extractSectionsByHeading,
  getPositionForInsertAnchor,
  getRangeForReplaceSection as getRangeForReplaceSectionImpl,
  type InsertAnchor,
} from "./section-extractor-utils";

import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import TextAlign from "@tiptap/extension-text-align";
import Audio from "@tiptap/extension-audio";

import { AdditionMark, DeletionMark } from "./diff/diff-marks";
import { computeDiffDocument } from "./diff/diff-utils";
import {
  applyLibraryDiff as applyLibraryDiffImpl,
  resolveBlock as resolveBlockImpl,
  resolveAllChanges as resolveAllChangesImpl,
} from "./diff/inline-diff-utils";

import { CustomImageExtension } from "./extensions/custom-image-extension";
import { createPinnedHighlightExtension } from "./extensions/pinned-highlight-extension";
import { createChangeManagerExtension, docHasChanges } from "./extensions/change-manager-extension";
import {
  PeerReviewCommentMark,
  findTextRangeInDocument,
  findTextRangeInSingleNode,
} from "../../peer-review/peer-review-comment-mark";
import { PeerSuggestionApplyOverlays } from "../../peer-review/peer-suggestion-apply-overlays";
import { reconcileAppliedPeerSuggestionIds, setsEqualString } from "../../peer-review/peer-review-editor-utils";
import { DiffReviewBanner } from "./diff/diff-review-banner";
import { EditorToolbar } from "./toolbar/editor-toolbar";
import { PeerReviewBubbleMenu } from "../../peer-review/peer-review-bubble-menu";
import type { SelectionContext, TiptapEditorHandle, TiptapEditorProps } from "./tiptap-types";

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
            {isReviewMode && (
                <DiffReviewBanner onRejectDiff={onRejectDiff} onAcceptDiff={onAcceptDiff} />
            )}

            {editable && !isReviewMode && (
                <EditorToolbar
                    editor={editor}
                    imageFileInputRef={imageFileInputRef}
                    audioFileInputRef={audioFileInputRef}
                    onImageChange={handleImageSelect}
                    onAudioChange={handleAudioSelect}
                />
            )}

            {peerReviewMode && (
                <PeerReviewBubbleMenu
                    editor={editor}
                    onPeerReviewHighlightComment={onPeerReviewHighlightComment}
                    peerCommentType={peerCommentType}
                    setPeerCommentType={setPeerCommentType}
                    peerCommentBubbleKey={peerCommentBubbleKey}
                    peerCommentDraftRef={peerCommentDraftRef}
                    peerCommentSubmitting={peerCommentSubmitting}
                    onSubmit={submitPeerReviewComment}
                />
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







