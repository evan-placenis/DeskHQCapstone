"use client";

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from 'tiptap-markdown' // You need to install this
import { useEffect, useMemo, useState, useRef, forwardRef, useImperativeHandle, useCallback } from 'react'

import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import TextAlign from '@tiptap/extension-text-align'

// 1. Import the component and ReactNodeViewRenderer
import { ReactNodeViewRenderer } from '@tiptap/react'
import Image from '@tiptap/extension-image'
import Audio from '@tiptap/extension-audio'
import { ReportImageComponent } from './ReportImageComponent'
import { AdditionMark, DeletionMark } from './DiffMarks'
import { computeDiffDocument } from './diffUtils'
import { Button } from '../ui_components/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '../ui_components/dropdown-menu'
import { Check, X, Heading as HeadingIcon, ChevronDown, AlignLeft, AlignCenter, AlignRight, AlignJustify, List, ListOrdered, Image as ImageIcon, FileAudio, Table2, Plus, Minus, Trash2, Columns, Rows } from 'lucide-react'


// 2. Customize the Image Extension
// We extend the official @tiptap/extension-image with:
//   - data-src attribute trick to prevent 404s when src is a UUID
//   - Custom NodeView (ReportImageComponent) to resolve UUIDs → signed Supabase URLs
//   - Legacy parseHTML support for older report formats
const CustomImageExtension = Image.extend({
    name: 'image',
    draggable: true,

    addAttributes() {
        return {
            ...this.parent?.(),
            src: {
                default: null,
                // Look for data-src first (our safe storage), then src (legacy/standard)
                parseHTML: element => element.getAttribute('data-src') || element.getAttribute('src'),
                // Write UUID/URL to data-src, put a transparent placeholder in src
                // This prevents the browser from making failed requests for UUID strings
                renderHTML: attributes => ({
                    'data-src': attributes.src,
                    'src': 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
                }),
            },
            alt: { default: null },
            title: { default: null },
        }
    },
    // Support parsing legacy report formats alongside standard <img> tags
    parseHTML() {
        return [
            { tag: 'img[src]' },
            { tag: 'img[data-src]' },
            { tag: 'div[data-type="report-image"]' }, // Legacy support
        ]
    },
    renderHTML({ HTMLAttributes }) {
        return ['span', { 'data-type': 'report-image', ...HTMLAttributes }]
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
    /** Collapse the selection so the next getSelectionContext() returns null (e.g. after using selection for an edit). */
    clearSelection: () => void;
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

    // Determine if we're in review mode
    const isReviewMode = !!diffContent;

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
            Markdown.configure({
                transformPastedText: true,
                transformCopiedText: true,
                // @ts-ignore
                serializers: {
                    image: (state: any, node: any) => {
                        // Forces: ![Alt](Src)
                        // Uses a safety check (|| '') to prevent crashes if attributes are missing
                        const alt = state.esc(node.attrs.alt || '');
                        const src = state.esc(node.attrs.src || '');
                        state.write(`![${alt}](${src})`);
                    }
                }
            }),   // <--- The Magic: Allows Tiptap to read/write Markdown
            // 2. Register Table (Configure it to allow resizing)
            Table.configure({
                resizable: true,
                HTMLAttributes: {
                    class: 'my-table-class',
                },
            }),
            TableRow,
            TableHeader,
            TableCell,
        ],
        content: content, // Always start with the content prop
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
                [&_th]:border [&_th]:border-slate-300 [&_th]:bg-slate-50 [&_th]:font-semibold
            `.replace(/\s+/g, ' ').trim(),
            },
        },

        onUpdate: ({ editor }) => {
            // Don't update if we're in review mode OR if we're currently updating
            // This prevents the infinite loop
            if (isReviewMode || isUpdatingRef.current) return;

            // When user types, we extract the new Markdown
            const newMarkdown = (editor.storage as any).markdown.getMarkdown();
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
                const currentMarkdown = (editor.storage as any).markdown.getMarkdown();
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
                editor.commands.setContent(diffMarkdown);
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
            currentMarkdown = (editor.storage as any).markdown.getMarkdown();
        } catch (e) {
            console.warn("Tiptap storage not ready yet");
            return;
        }

        // Only apply if the incoming content is genuinely different from what's in the editor
        if (content && content !== currentMarkdown) {
            editor.commands.setContent(content);
        }
    }, [content, editor, isReviewMode]);

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
                const storage = (editor.storage as any).markdown;
                fullMarkdown = storage?.getMarkdown() ?? '';
                const slice = doc.slice(from, to);
                markdown = storage?.serializer?.serialize(slice.content) ?? selection;
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
                    const storage = (editor.storage as any).markdown;
                    fullMarkdown = storage?.getMarkdown() ?? '';
                    const slice = doc.slice(from, to);
                    markdown = storage?.serializer?.serialize(slice.content) ?? selection;
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
                try {
                    editor.chain().focus().setTextSelection({ from: range.from, to: range.to }).deleteSelection().run();
                    // tiptap-markdown extends commands with insertContentAt(position, markdownString)
                    const commands = editor.commands as { insertContentAt?: (pos: number, content: string) => boolean };
                    if (typeof commands.insertContentAt === "function") {
                        commands.insertContentAt(range.from, newMarkdown);
                    } else {
                        editor.commands.insertContent(newMarkdown);
                    }
                } catch (e) {
                    console.warn("replaceRange failed, inserting as plain text", e);
                    editor.chain().focus().setTextSelection({ from: range.from, to: range.to }).deleteSelection().run();
                    editor.commands.insertContent(newMarkdown);
                }
            },
            clearSelection() {
                if (!editor || isReviewMode) return;
                const { from } = editor.state.selection;
                editor.commands.setTextSelection(from);
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
                                className="px-2 border rounded flex items-center gap-1"
                                title="Heading level"
                            >
                                <HeadingIcon className="w-4 h-4" />
                                <span>Heading</span>
                                <ChevronDown className="w-3.5 h-3.5 opacity-70" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                            <DropdownMenuItem onClick={() => editor.chain().focus().setParagraph().run()}>
                                Paragraph
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
                                Heading 1
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
                                Heading 2
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
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





// import { diff_match_patch } from 'diff-match-patch';

// const dmp = new diff_match_patch();

// // When AI returns 'aiText'
// const diffs = dmp.diff_main(currentText, aiText);
// dmp.diff_cleanupSemantic(diffs);

// // This 'diffs' array can be used to render Red/Green highlights
// // You would build a custom Tiptap extension to render these,
// // OR just show a "Review Changes" modal before accepting.