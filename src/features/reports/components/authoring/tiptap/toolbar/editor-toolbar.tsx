"use client";

import type { Editor } from "@tiptap/core";
import type React from "react";

function inputRef<T extends HTMLInputElement>(r: React.RefObject<T | null>): React.Ref<T> {
  return r as React.Ref<T>;
}
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Heading as HeadingIcon,
  ChevronDown,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Image as ImageIcon,
  FileAudio,
  Table2,
  Plus,
  Minus,
  Trash2,
  Columns,
  Rows,
} from "lucide-react";

export function EditorToolbar({
  editor,
  imageFileInputRef,
  audioFileInputRef,
  onImageChange,
  onAudioChange,
}: {
  editor: Editor;
  imageFileInputRef: React.RefObject<HTMLInputElement | null>;
  audioFileInputRef: React.RefObject<HTMLInputElement | null>;
  onImageChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAudioChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="flex gap-2 mb-2 border-b border-slate-100 pb-2 sticky top-0 bg-white z-10 pt-1 -mt-1">
      <button onClick={() => editor.chain().focus().toggleBold().run()} className="font-bold px-2 border rounded">
        B
      </button>
      <button onClick={() => editor.chain().focus().toggleItalic().run()} className="italic px-2 border rounded">
        I
      </button>
      <button
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={`p-2 border rounded ${editor.isActive("bulletList") ? "bg-slate-100 border-slate-300" : ""}`}
        title="Bullet list"
      >
        <List className="w-4 h-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={`p-2 border rounded ${editor.isActive("orderedList") ? "bg-slate-100 border-slate-300" : ""}`}
        title="Numbered list"
      >
        <ListOrdered className="w-4 h-4" />
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={`px-2 border rounded flex items-center gap-1 ${editor.isActive("heading") ? "bg-slate-100 border-slate-300" : ""}`}
            title="Heading level"
          >
            <HeadingIcon className="w-4 h-4" />
            <span>
              {editor.isActive("heading") ? `Heading ${editor.getAttributes("heading").level}` : "Heading"}
            </span>
            <ChevronDown className="w-3.5 h-3.5 opacity-70" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem
            onClick={() => editor.chain().focus().setParagraph().run()}
            className={!editor.isActive("heading") ? "bg-slate-50 text-slate-600" : ""}
          >
            Paragraph
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={editor.isActive("heading", { level: 1 }) ? "bg-slate-50 text-slate-600" : ""}
          >
            Heading 1
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={editor.isActive("heading", { level: 2 }) ? "bg-slate-50 text-slate-600" : ""}
          >
            Heading 2
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            className={editor.isActive("heading", { level: 3 }) ? "bg-slate-50 text-slate-600" : ""}
          >
            Heading 3
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <span className="w-px bg-slate-200 self-stretch" aria-hidden />
      <div className="flex items-center gap-0.5" role="group" aria-label="Text alignment">
        <button
          onClick={() => {
            editor.commands.focus();
            editor.commands.setTextAlign("left");
          }}
          className={`p-2 border rounded ${editor.isActive("textAlign", { textAlign: "left" }) ? "bg-slate-100 border-slate-300" : ""}`}
          title="Align left"
        >
          <AlignLeft className="w-4 h-4" />
        </button>
        <button
          onClick={() => {
            editor.commands.focus();
            editor.commands.setTextAlign("center");
          }}
          className={`p-2 border rounded ${editor.isActive("textAlign", { textAlign: "center" }) ? "bg-slate-100 border-slate-300" : ""}`}
          title="Align center"
        >
          <AlignCenter className="w-4 h-4" />
        </button>
        <button
          onClick={() => {
            editor.commands.focus();
            editor.commands.setTextAlign("right");
          }}
          className={`p-2 border rounded ${editor.isActive("textAlign", { textAlign: "right" }) ? "bg-slate-100 border-slate-300" : ""}`}
          title="Align right"
        >
          <AlignRight className="w-4 h-4" />
        </button>
        <button
          onClick={() => {
            editor.commands.focus();
            editor.commands.setTextAlign("justify");
          }}
          className={`p-2 border rounded ${editor.isActive("textAlign", { textAlign: "justify" }) ? "bg-slate-100 border-slate-300" : ""}`}
          title="Justify"
        >
          <AlignJustify className="w-4 h-4" />
        </button>
      </div>
      <span className="w-px bg-slate-200 self-stretch" aria-hidden />
      <input ref={inputRef(imageFileInputRef)} type="file" accept="image/*" className="hidden" onChange={onImageChange} />
      <button onClick={() => imageFileInputRef.current?.click()} className="p-2 border rounded" title="Insert image">
        <ImageIcon className="w-4 h-4" />
      </button>
      <input ref={inputRef(audioFileInputRef)} type="file" accept="audio/*" className="hidden" onChange={onAudioChange} />
      <button onClick={() => audioFileInputRef.current?.click()} className="p-2 border rounded" title="Insert audio">
        <FileAudio className="w-4 h-4" />
      </button>
      <span className="w-px bg-slate-200 self-stretch" aria-hidden />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={`px-2 border rounded flex items-center gap-1 ${editor.isActive("table") ? "bg-slate-100 border-slate-300" : ""}`}
            title="Table"
          >
            <Table2 className="w-4 h-4" />
            <span>Table</span>
            <ChevronDown className="w-3.5 h-3.5 opacity-70" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[180px]">
          <DropdownMenuItem
            onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
          >
            <Plus className="w-4 h-4 mr-2" /> Insert Table (3×3)
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => editor.chain().focus().insertTable({ rows: 2, cols: 2, withHeaderRow: true }).run()}
          >
            <Plus className="w-4 h-4 mr-2" /> Insert Table (2×2)
          </DropdownMenuItem>
          {editor.isActive("table") && (
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
              <DropdownMenuItem
                onClick={() => editor.chain().focus().deleteTable().run()}
                className="text-red-600 focus:text-red-600"
              >
                <Trash2 className="w-4 h-4 mr-2" /> Delete Table
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
