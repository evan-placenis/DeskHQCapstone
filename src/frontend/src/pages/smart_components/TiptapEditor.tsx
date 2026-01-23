"use client";

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from 'tiptap-markdown' // You need to install this
import { useEffect } from 'react'

import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'

// 1. Import the component and ReactNodeViewRenderer
import { ReactNodeViewRenderer } from '@tiptap/react'
import Image from '@tiptap/extension-image'
import { ReportImageComponent } from './ReportImageComponent'

// 2. Customize the Image Extension
const CustomImageExtension = Image.extend({
    name: 'image', // Rename it to avoid conflict with default Image
    group: 'block',      // Ensure it behaves like a block element
    draggable: true,

    addAttributes() {
        return {
            ...this.parent?.(),
            src: { default: null },
            alt: { default: null },
        }
    },
    renderHTML({ HTMLAttributes }) {
        return ['div', { 'data-type': 'report-image', ...HTMLAttributes }]
    },
    addNodeView() {
        return ReactNodeViewRenderer(ReportImageComponent)
    },
}).configure({
    allowBase64: true,
    inline: false,
})


interface TiptapEditorProps {
    content: string; // This expects the Markdown string from your processNode
    editable?: boolean; //make everything editable
    onUpdate?: (newContent: string) => void;
}

export function TiptapEditor({ content, editable = true, onUpdate }: TiptapEditorProps) {
    const editor = useEditor({
        immediatelyRender: false,
        extensions: [
            StarterKit, // Handles Bold, Italic, Bullet Lists, History, etc.
            //Image,      // Handles <img /> tags if you decide to inline them later
            Markdown,   // <--- The Magic: Allows Tiptap to read/write Markdown
            CustomImageExtension,
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
        content: content, // Initialize with your Markdown string
        editable: editable,
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
            // When user types, we extract the new Markdown
            const newMarkdown = (editor.storage as any).markdown.getMarkdown();
            if (onUpdate) onUpdate(newMarkdown);
        },
    })

    // Update editor content if the prop changes externally (e.g. from AI regeneration)
    useEffect(() => {
        if (!editor) return;

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
    }, [content, editor]);

    if (!editor) return null;

    return (
        <div className="border border-slate-200 rounded-md p-4 bg-white shadow-sm">
            {/* Simple Toolbar */}
            {editable && (
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