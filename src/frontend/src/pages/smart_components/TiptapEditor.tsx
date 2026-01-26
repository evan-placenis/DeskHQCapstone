"use client";

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from 'tiptap-markdown' // You need to install this
import { useEffect, useMemo, useState, useRef } from 'react'

import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'

// 1. Import the component and ReactNodeViewRenderer
import { ReactNodeViewRenderer } from '@tiptap/react'
import Image from '@tiptap/extension-image'
import { ReportImageComponent } from './ReportImageComponent'
import { AdditionMark, DeletionMark } from './DiffMarks'
import { computeDiffDocument } from './diffUtils'
import { Button } from '../ui_components/button'
import { Check, X } from 'lucide-react'


// 2. Customize the Image Extension
const CustomImageExtension = Image.extend({
    name: 'image', // Rename it to avoid conflict with default Image
    group: 'inline',
    inline: true,
    draggable: true,

    addAttributes() {
        return {
            ...this.parent?.(),
            src: {
                default: null,
                // 🟢 PARSING: Look for data-src first (our safe storage), then src (legacy)
                parseHTML: element => element.getAttribute('data-src') || element.getAttribute('src'),

                // 🟢 RENDERING: Write UUID to data-src, but put a placeholder in src
                // This prevents the 404 error because the browser loads the valid placeholder
                // instead of trying to load "uuid-123".
                renderHTML: attributes => ({
                    'data-src': attributes.src,
                    'src': 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7' // Transparent 1x1 pixel
                }),
            },
            alt: { default: null },
        }
    },
    // 🛡️ 2. This helper lets it load your OLD reports that might still have <div> tags
    parseHTML() {
        return [
            { tag: 'img[src]' },                   // Standard
            { tag: 'div[data-type="report-image"]' }, // Legacy support
            { tag: 'img[data-src]' }, // match our new format
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


interface TiptapEditorProps {
    content: string; // This expects the Markdown string from your processNode
    editable?: boolean; //make everything editable
    onUpdate?: (newContent: string) => void;
    diffContent?: string | null; // New content to compare against (enables review mode)
    onAcceptDiff?: () => void; // Callback when user accepts the diff
    onRejectDiff?: () => void; // Callback when user rejects the diff
}

export function TiptapEditor({
    content,
    editable = true,
    onUpdate,
    diffContent,
    onAcceptDiff,
    onRejectDiff
}: TiptapEditorProps) {
    // Store the original markdown when entering review mode to prevent infinite loops
    const originalMarkdownRef = useRef<string | null>(null);
    const [originalMarkdown, setOriginalMarkdown] = useState<string | null>(null);
    const isUpdatingRef = useRef(false);

    // Determine if we're in review mode
    const isReviewMode = !!diffContent;

    const editor = useEditor({
        immediatelyRender: false,
        extensions: [
            StarterKit, // Handles Bold, Italic, Bullet Lists, History, etc.
            CustomImageExtension,
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

                prose-ul:list-none prose-ol:list-none prose-li:text-[13.3px] prose-li:my-0 prose-li:pl-0

                [&_td]:align-top [&_th]:align-top
                
                [&_td]:w-1/2
                
                [&_td]:p-3
                
                prose-table:border-0 prose-tr:border-b-0 
                [&_td]:border-0
            `.replace(/\s+/g, ' ').trim(),
            },
        },

        onUpdate: ({ editor }) => {
            // Don't update if we're in review mode OR if we're currently updating
            // This prevents the infinite loop
            if (isReviewMode || isUpdatingRef.current) return;

            // When user types, we extract the new Markdown
            const newMarkdown = (editor.storage as any).markdown.getMarkdown();
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
    // Skip this if we're in review mode
    useEffect(() => {
        if (!editor || isReviewMode) return;

        // 2. Get current editor state
        // We use a try-catch because .storage.markdown access can sometimes be flaky during init
        let currentMarkdown = "";
        try {
            currentMarkdown = (editor.storage as any).markdown.getMarkdown();
        } catch (e) {
            console.warn("Tiptap storage not ready yet");
            return;
        }

        // 3. Compare and Update
        // We check if content exists AND if it is different from what's in the editor
        if (content && content !== currentMarkdown) {

            // PREVENT CURSOR JUMPING:
            // Only force update if the editor is virtually empty OR if the incoming content 
            // is significantly different (like a fresh load from DB).
            const isEditorEmpty = currentMarkdown.trim() === "";

            if (isEditorEmpty) {
                // Initial Load: Set content and don't worry about cursor
                editor.commands.setContent(content);
            } else {
                // Update from AI/Server while user might be typing:
                // Ideally, you'd use a more complex diff here, but for now:
                // We only update if they differ to avoid loops.
                editor.commands.setContent(content);
            }
        }
    }, [content, editor, isReviewMode]);

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

            {/* Simple Toolbar */}
            {editable && !isReviewMode && (
                <div className="flex gap-2 mb-2 border-b border-slate-100 pb-2">
                    <button onClick={() => editor.chain().focus().toggleBold().run()} className="font-bold px-2 border rounded">B</button>
                    <button onClick={() => editor.chain().focus().toggleItalic().run()} className="italic px-2 border rounded">I</button>
                    <button onClick={() => editor.chain().focus().toggleBulletList().run()} className="px-2 border rounded">• List</button>
                </div>
            )}
            <EditorContent editor={editor} />
        </div>
    )
}





// import { diff_match_patch } from 'diff-match-patch';

// const dmp = new diff_match_patch();

// // When AI returns 'aiText'
// const diffs = dmp.diff_main(currentText, aiText);
// dmp.diff_cleanupSemantic(diffs);

// // This 'diffs' array can be used to render Red/Green highlights
// // You would build a custom Tiptap extension to render these,
// // OR just show a "Review Changes" modal before accepting.