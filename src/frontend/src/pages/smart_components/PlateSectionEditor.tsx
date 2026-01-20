import React, { useEffect } from 'react';
import { 
  Plate, 
  usePlateEditor, 
} from '@udecode/plate/react';

// Plugins
import { BoldPlugin, ItalicPlugin, UnderlinePlugin } from '@udecode/plate-basic-marks/react';
import { HeadingPlugin } from '@udecode/plate-heading/react';
import { ListPlugin } from '@udecode/plate-list/react'; 
import { ImagePlugin } from '@udecode/plate-media/react';
import { serializeMd } from '@udecode/plate-markdown';

import { Editor } from '@/src/frontend/src/pages/plate_components/editor';
import { FixedToolbarButtons } from '@/src/frontend/src/pages/plate_components/plate-ui/fixed-toolbar';

const EDITOR_PLUGINS = [
  BoldPlugin,
  ItalicPlugin,
  UnderlinePlugin,
  HeadingPlugin,
  ListPlugin, 
  ImagePlugin,
];

// --- COMPONENT DEFINITIONS ---

// Headers
const Heading1 = ({ attributes, children }: any) => <h1 {...attributes} className="mb-4 mt-6 text-3xl font-bold text-slate-900 clear-both">{children}</h1>;
const Heading2 = ({ attributes, children }: any) => <h2 {...attributes} className="mb-3 mt-5 text-2xl font-semibold text-slate-800 clear-both">{children}</h2>;
const Heading3 = ({ attributes, children }: any) => <h3 {...attributes} className="mb-2 mt-4 text-xl font-medium text-slate-800 clear-both">{children}</h3>;
const Paragraph = ({ attributes, children }: any) => <p {...attributes} className="mb-2 text-slate-700 leading-relaxed">{children}</p>;

// Lists
const BulletList = ({ attributes, children }: any) => (
  <ul {...attributes} className="mb-2 ml-6 list-disc [&>li]:mt-1 text-slate-800">{children}</ul>
);
const NumberList = ({ attributes, children }: any) => (
  <ol {...attributes} className="mb-2 ml-6 list-decimal [&>li]:mt-1 text-slate-800">{children}</ol>
);
const ListItem = ({ attributes, children }: any) => (
  <li 
    {...attributes} 
    className="pl-1 clear-both py-2" // Added clear-both and padding
  >
    {children}
  </li>
);

// 🟢 2-COLUMN MAGIC: Floating Image Component
// This component floats to the right, allowing text to wrap on the left.
const ImageElement = ({ attributes, children, element, selected, focused }: any) => {
  return (
    <div 
      {...attributes} 
      contentEditable={false} 
      className={`
        float-right ml-4 mb-2 mt-0
        w-[250px] h-[180px]
        rounded-lg border border-slate-200 bg-white p-1 shadow-sm
        overflow-hidden
        ${selected && focused ? 'ring-2 ring-blue-500' : ''}
      `}
    >
        {/* Use object-cover to make images uniform size */}
        <img 
            src={element.url} 
            alt={element.caption || 'Evidence'} 
            className="h-full w-full object-cover rounded-md"
            draggable={false}
            // 🟢 Fallback for broken images
            onError={(e) => {
                e.currentTarget.style.display = 'none'; // Hide if broken
                e.currentTarget.parentElement!.style.backgroundColor = '#f1f5f9'; // Grey box
                e.currentTarget.parentElement!.innerHTML = '<span class="text-xs text-slate-400 p-4">Image Error</span>';
            }}
        />
      <div className="hidden">{children}</div>
    </div>
  );
};

// 🟢 PARSER
const parseMarkdownToNodes = (md: string) => {
    const nodes: any[] = [];
    const lines = md.split('\n');
    let currentList: any = null;

    lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) return; 

        // 1. Headers
        if (trimmed.startsWith('# ')) {
            currentList = null;
            nodes.push({ type: 'h1', children: [{ text: trimmed.replace('# ', '') }] });
        } 
        else if (trimmed.startsWith('## ')) {
            currentList = null;
            nodes.push({ type: 'h2', children: [{ text: trimmed.replace('## ', '') }] });
        }
        // 2. Images: ![caption](url)
        else if (trimmed.startsWith('![') && trimmed.includes('](')) {
            currentList = null;
            const match = trimmed.match(/!\[(.*?)\]\((.*?)\)/);
            if (match) {
                nodes.push({
                    type: 'img',
                    url: match[2],
                    caption: match[1],
                    children: [{ text: '' }]
                });
            }
        }
        // 3. Bullet Points
        else if (trimmed.startsWith('- ')) {
            if (!currentList) {
                currentList = { type: 'ul', children: [] };
                nodes.push(currentList);
            }
            currentList.children.push({ 
                type: 'li', 
                children: [
                    { type: 'p', children: [{ text: trimmed.replace('- ', '') }] }
                ] 
            });
        }
        // 4. Paragraphs
        else {
            currentList = null;
            nodes.push({ type: 'p', children: [{ text: trimmed }] });
        }
    });

    if (nodes.length === 0) return [{ type: 'p', children: [{ text: '' }] }];
    return nodes;
};

interface PlateSectionEditorProps {
  initialMarkdown: string;
  onChange: (markdown: string) => void;
}

export function PlateSectionEditor({ initialMarkdown, onChange }: PlateSectionEditorProps) {
  
  const editor = usePlateEditor({
    plugins: EDITOR_PLUGINS,
    override: {
      components: {
        h1: Heading1,
        h2: Heading2,
        h3: Heading3,
        p: Paragraph,
        ul: BulletList,
        ol: NumberList,
        li: ListItem,
        img: ImageElement, // Uses our floating component
      }
    },
    value: [{ type: 'p', children: [{ text: '' }] }],
  });

  useEffect(() => {
    if (initialMarkdown) {
      try {
        const nodes = parseMarkdownToNodes(initialMarkdown);
        editor.children = nodes;
        setTimeout(() => (editor as any).onChange(), 10);
      } catch (err) {
        console.warn("Parsing failed", err);
      }
    }
  }, [initialMarkdown]); 

  const handleSave = () => {
    try {
      if (editor.children.length > 0) {
         const markdown = serializeMd(editor as any);
         onChange(markdown);
      }
    } catch (e) {
      console.error("Save failed:", e);
    }
  };

  return (
    <Plate editor={editor}>
      <div 
        className="relative group border border-slate-200 rounded-lg shadow-sm bg-white"
        onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) {
                handleSave();
            }
        }}
      >
        <div className="border-b border-slate-100 p-2 bg-slate-50/50 rounded-t-lg sticky top-0 z-10">
           <FixedToolbarButtons />
        </div>
        
        <Editor 
          className="min-h-[500px] p-8 focus:outline-none clearfix" // clearfix added
          placeholder="Type your report here..."
        />
      </div>
    </Plate>
  );
}