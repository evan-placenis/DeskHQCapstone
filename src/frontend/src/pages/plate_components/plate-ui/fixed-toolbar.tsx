import React from 'react';
import { useEditorRef } from '@udecode/plate/react';
import { Editor, Transforms, Element as SlateElement } from 'slate'; 

import { 
  Bold, 
  Italic, 
  Underline, 
  Plus, 
  Minus,
  List,       // 🟢 Icon for Bullet List
  ListOrdered // 🟢 Icon for Numbered List
} from 'lucide-react';

import { Button } from '@/src/frontend/src/pages/ui_components/button';
import { Toolbar } from './toolbar';
import { cn } from '../../../lib/utils';

export function FixedToolbar({ className, children, ...props }: any) {
  return (
    <div
      className={cn(
        'sticky left-0 top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60',
        className
      )}
      {...props}
    >
        <Toolbar className="flex w-full items-center justify-between overflow-x-auto p-1">
            {children}
        </Toolbar>
    </div>
  );
}

export function FixedToolbarButtons() {
  const editor = useEditorRef();

  // --- 1. Basic Formatting ---
  const toggleMark = (format: string) => {
    if (!editor) return;
    const marks = Editor.marks(editor as any) as Record<string, any>;
    const isActive = marks ? marks[format] === true : false;
    if (isActive) {
      Editor.removeMark(editor as any, format);
    } else {
      Editor.addMark(editor as any, format, true);
    }
  };

  // --- 2. Font Size Logic ---
  const setType = (newType: string) => {
    if (!editor) return;
    Transforms.setNodes(
      editor as any,
      { type: newType } as any,
      { match: n => !Editor.isEditor(n) && SlateElement.isElement(n) } 
    );
  };

  const increaseSize = () => {
    const [match] = Editor.nodes(editor as any, { match: n => SlateElement.isElement(n) && (n as any).type });
    const current = match ? (match[0] as any).type : 'p';

    let next = 'h3';
    if (current === 'h3') next = 'h2';
    if (current === 'h2') next = 'h1';
    if (current === 'h1') next = 'h1';
    setType(next);
  };

  const decreaseSize = () => {
    const [match] = Editor.nodes(editor as any, { match: n => SlateElement.isElement(n) && (n as any).type });
    const current = match ? (match[0] as any).type : 'p';

    let next = 'h2';
    if (current === 'h1') next = 'h2';
    if (current === 'h2') next = 'h3';
    if (current === 'h3') next = 'p';
    setType(next);
  };

  // --- 3. List Logic (🟢 NEW) ---
  const toggleList = (listType: 'ul' | 'ol') => {
    if (!editor) return;

    const [match] = Editor.nodes(editor as any, {
      match: n => !Editor.isEditor(n) && SlateElement.isElement(n) && ((n as any).type === 'ul' || (n as any).type === 'ol'),
    });
    const isList = !!match;

    Transforms.unwrapNodes(editor as any, {
      match: n => !Editor.isEditor(n) && SlateElement.isElement(n) && ((n as any).type === 'ul' || (n as any).type === 'ol'),
      split: true,
    });

    if (!isList) {
      const block = { type: listType, children: [] };
      Transforms.wrapNodes(editor as any, block);
      
      // Ensure children are list items
      Transforms.setNodes(
         editor as any, 
         { type: 'li' } as any,
         { match: n => SlateElement.isElement(n) && (n as any).type === 'p' }
      );
    }
  };

  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="sm" onClick={() => toggleMark('bold')}>
        <Bold className="w-4 h-4" />
      </Button>
      <Button variant="ghost" size="sm" onClick={() => toggleMark('italic')}>
        <Italic className="w-4 h-4" />
      </Button>
      <Button variant="ghost" size="sm" onClick={() => toggleMark('underline')}>
        <Underline className="w-4 h-4" />
      </Button>
      
      <div className="w-[1px] h-4 bg-slate-300 mx-2" />

      <Button variant="ghost" size="sm" onClick={decreaseSize} title="Decrease Size">
        <Minus className="w-4 h-4" />
      </Button>
      <Button variant="ghost" size="sm" onClick={increaseSize} title="Increase Size">
        <Plus className="w-4 h-4" />
      </Button>

      <div className="w-[1px] h-4 bg-slate-300 mx-2" />

      {/* 🟢 LIST BUTTONS */}
      <Button variant="ghost" size="sm" onClick={() => toggleList('ul')} title="Bullet List">
        <List className="w-4 h-4" />
      </Button>
      <Button variant="ghost" size="sm" onClick={() => toggleList('ol')} title="Numbered List">
        <ListOrdered className="w-4 h-4" />
      </Button>
    </div>
  );
}