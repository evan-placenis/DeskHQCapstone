"use client";

import { Button } from "../ui_components/button";
import { Check, X, Sparkles, UserCheck, LayoutList, Text } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import rehypeRaw from "rehype-raw";
import { diffLines, diffWords, Change } from "diff";
import { useMemo, useState } from "react";
import { ToggleGroup, ToggleGroupItem } from "../ui_components/toggle-group"; 

interface DiffViewProps {
  oldText: string;
  newText: string;
  changes?: Change[]; 
  stats?: { changeSummary: string }; 
  onAccept: () => void;
  onReject: () => void;
  sectionTitle?: string;
  source?: "ai" | "peer-review";
}

export function DiffView({
  oldText,
  newText,
  stats, 
  onAccept,
  onReject,
  sectionTitle,
  source = "ai"
}: DiffViewProps) {
  
  const isPeerReview = source === "peer-review";
  const [viewMode, setViewMode] = useState<'line' | 'word'>('word');

  // --- 1. CALCULATE LINE DIFFS ---
  const lineDiffs = useMemo(() => diffLines(oldText, newText), [oldText, newText]);

  // --- 2. CALCULATE WORD DIFFS (HYBRID) ---
  const processedDiffs = useMemo(() => {
    const result: { type: 'added' | 'removed' | 'unchanged' | 'mixed', value: string, wordDiffs?: Change[] }[] = [];
    
    for (let i = 0; i < lineDiffs.length; i++) {
        const current = lineDiffs[i];
        const next = lineDiffs[i + 1];

        // Detect a "mix" (Modification): Removed Block followed immediately by Added Block
        if (current.removed && next && next.added) {
            const wordDiffs = diffWords(current.value, next.value);
            result.push({
                type: 'mixed', // We use 'mixed' internally, but render it neutrally
                value: next.value, 
                wordDiffs: wordDiffs
            });
            i++; // Skip next block
        } 
        else if (current.added) {
            result.push({ type: 'added', value: current.value });
        }
        else if (current.removed) {
            result.push({ type: 'removed', value: current.value });
        }
        else {
            result.push({ type: 'unchanged', value: current.value });
        }
    }
    return result;
  }, [lineDiffs]);

  /**
   * Helper: Renders the inline HTML for word-level diffs
   */
  const renderInlineDiffs = (wordDiffs: Change[]) => {
    const htmlContent = wordDiffs.map(part => {
        if (part.added) {
            // Strong Green Highlight
            return `<span class="bg-green-100 text-green-700 font-medium border-b-2 border-green-200 px-0.5 rounded-sm">${part.value}</span>`;
        }
        if (part.removed) {
            // Red Strikethrough
            return `<span class="bg-red-50 text-red-500 line-through decoration-red-300 px-0.5 rounded-sm">${part.value}</span>`;
        }
        // Normal text
        return part.value;
    }).join('');

    return (
        <ReactMarkdown rehypePlugins={[rehypeRaw]}>
            {htmlContent}
        </ReactMarkdown>
    );
  };

  return (
    <div className={`border-2 ${isPeerReview ? 'border-theme-primary-30 bg-theme-primary-lighter' : 'border-blue-200 bg-blue-50/30'} rounded-lg p-4 space-y-3`}>
      
      {/* --- HEADER --- */}
      <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
                {isPeerReview ? (
                    <UserCheck className="w-4 h-4 text-theme-primary" />
                ) : (
                    <Sparkles className="w-4 h-4 text-blue-600" />
                )}
                <span className={`text-sm font-semibold ${isPeerReview ? 'text-theme-secondary' : 'text-blue-900'}`}>
                    {isPeerReview ? 'Peer Review' : 'AI'} Suggested Edit{sectionTitle ? ` for "${sectionTitle}"` : ""}
                </span>
                {stats && ( 
                    <span className="ml-2 text-xs bg-white/80 px-2 py-0.5 rounded-full border border-blue-200 text-blue-700 shadow-sm">
                    {stats.changeSummary}
                    </span>
                )}
            </div>

            {/* Toggle: Block vs Detail */}
            <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                <ToggleGroup type="single" value={viewMode} onValueChange={(v) => v && setViewMode(v as 'line' | 'word')} className="gap-0.5">
                    <ToggleGroupItem 
                        value="line" 
                        size="sm" 
                        className={`h-6 text-[10px] px-2 rounded-md transition-all ${viewMode === 'line' ? 'bg-white text-slate-800 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <LayoutList className="w-3 h-3 mr-1" /> Block
                    </ToggleGroupItem>
                    <ToggleGroupItem 
                        value="word" 
                        size="sm" 
                        className={`h-6 text-[10px] px-2 rounded-md transition-all ${viewMode === 'word' ? 'bg-white text-slate-800 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Text className="w-3 h-3 mr-1" /> Detail
                    </ToggleGroupItem>
                </ToggleGroup>
            </div>
        </div>

        {/* --- CONTENT AREA --- */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden min-h-[80px] text-sm">
             
             {/* 1. WORD MODE (Detailed inline diffs) */}
             {viewMode === 'word' && processedDiffs.map((part, index) => {
                 
                 // MIXED (Inline edits): Render on plain white, no borders, no icons.
                 if (part.type === 'mixed' && part.wordDiffs) {
                     return (
                        <div key={index} className="bg-white pl-4 py-3 pr-4 border-l-4 border-transparent">
                            <div className="prose prose-sm max-w-none text-slate-800 leading-relaxed">
                                {renderInlineDiffs(part.wordDiffs)}
                            </div>
                        </div>
                     );
                 }
                 // PURE ADDITION (Green block)
                 else if (part.type === 'added') {
                     return (
                         <div key={index} className="bg-green-50 border-l-4 border-green-500 pl-4 py-2 pr-4">
                             <div className="prose prose-sm max-w-none text-slate-800">
                                <ReactMarkdown>{part.value}</ReactMarkdown>
                             </div>
                         </div>
                     );
                 } 
                 // PURE REMOVAL (Red block)
                 else if (part.type === 'removed') {
                     return (
                         <div key={index} className="bg-red-50 border-l-4 border-red-400 pl-4 py-2 pr-4 opacity-70">
                             <div className="prose prose-sm max-w-none text-slate-600 line-through decoration-red-300">
                                <ReactMarkdown>{part.value}</ReactMarkdown>
                             </div>
                         </div>
                     );
                 } 
                 // UNCHANGED (Dimmed)
                 else {
                     return (
                         <div key={index} className="pl-4 py-2 pr-4 border-l-4 border-transparent opacity-50 hover:opacity-100 transition-opacity">
                             <div className="prose prose-sm max-w-none text-slate-600">
                                <ReactMarkdown>{part.value}</ReactMarkdown>
                             </div>
                         </div>
                     );
                 }
             })}

             {/* 2. BLOCK MODE (Strict Green/Red Blocks) */}
             {viewMode === 'line' && lineDiffs.map((part, index) => {
                 if (part.added) {
                     return (
                         <div key={index} className="bg-green-50 border-l-4 border-green-500 pl-4 py-2 pr-4">
                             <div className="prose prose-sm max-w-none text-slate-800">
                                <ReactMarkdown>{part.value}</ReactMarkdown>
                             </div>
                         </div>
                     );
                 } else if (part.removed) {
                     return (
                         <div key={index} className="bg-red-50 border-l-4 border-red-400 pl-4 py-2 pr-4 opacity-70">
                             <div className="prose prose-sm max-w-none text-slate-600 line-through decoration-red-300">
                                <ReactMarkdown>{part.value}</ReactMarkdown>
                             </div>
                         </div>
                     );
                 } else {
                     return (
                         <div key={index} className="pl-4 py-2 pr-4 border-l-4 border-transparent opacity-50">
                             <div className="prose prose-sm max-w-none text-slate-600">
                                <ReactMarkdown>{part.value}</ReactMarkdown>
                             </div>
                         </div>
                     );
                 }
             })}
        </div>

      {/* --- FOOTER & LEGEND --- */}
      <div className="flex items-center justify-between pt-3 px-1">
         
         {/* LEGEND */}
         <div className="flex items-center gap-4 text-xs font-medium text-slate-600">
            <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 bg-green-100 border border-green-400 rounded"></div>
                <span>Added</span>
            </div>
            <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 bg-red-100 border border-red-400 rounded"></div>
                <span>Removed</span>
            </div>
        </div>

         {/* ACTIONS */}
         <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={onReject} className="h-8 text-xs rounded-lg hover:bg-red-50 hover:border-red-300 hover:text-red-700 transition-colors">
            <X className="w-3 h-3 mr-1.5" /> Reject
          </Button>
          <Button size="sm" onClick={onAccept} className="h-8 text-xs rounded-lg bg-green-600 hover:bg-green-700 text-white shadow-sm transition-all hover:shadow">
            <Check className="w-3 h-3 mr-1.5" /> Accept
          </Button>
        </div>
      </div>

    </div>
  );
}