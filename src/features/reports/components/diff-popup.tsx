"use client";

import { useEffect, useRef, useMemo } from 'react';
import { diff_match_patch } from 'diff-match-patch';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Button } from '../ui-components/button';
import { Check, X } from 'lucide-react';
import type { EditSuggestion } from '../report-editing-components/ai-chat-sidebar';
import { computeDiffDocument } from './diff-utils';

interface DiffPopupProps {
  suggestion: EditSuggestion;
  position?: { top: number; left: number };
  onAccept: () => void;
  onReject: () => void;
  onDismiss?: () => void;
}

/**
 * DiffPopup - Floating overlay for reviewing AI edit suggestions
 *
 * Uses computeDiffDocument (line-aware, structure-preserving) to produce
 * markdown with inline diff spans. Renders with ReactMarkdown + rehypeRaw
 * so markdown is formatted (headings, bold, lists) and diff spans show
 * red strikethrough (deletions) / green (additions).
 */
export function DiffPopup({
  suggestion,
  position,
  onAccept,
  onReject,
  onDismiss,
}: DiffPopupProps) {
  const popupRef = useRef<HTMLDivElement>(null);

  // Handle click outside to dismiss
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        onDismiss?.();
      }
    };

    // Handle Escape key
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onDismiss?.();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onDismiss]);

  // Structure-aware diff: markdown with inline spans (same as TiptapEditor diff view)
  const diffMarkdown = useMemo(
    () => computeDiffDocument(suggestion.originalText, suggestion.suggestedText),
    [suggestion.originalText, suggestion.suggestedText]
  );

  // Word-count stats for header
  const stats = useMemo(() => {
    const dmp = new diff_match_patch();
    const diffs = dmp.diff_main(suggestion.originalText, suggestion.suggestedText);
    dmp.diff_cleanupSemantic(diffs);
    let added = 0;
    let removed = 0;
    for (const [op, text] of diffs) {
      const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
      if (op === 1) added += wordCount;
      if (op === -1) removed += wordCount;
    }
    return { added, removed };
  }, [suggestion.originalText, suggestion.suggestedText]);

  // Default position if not provided (center of viewport)
  const popupStyle: React.CSSProperties = position
    ? {
        position: 'absolute',
        top: position.top,
        left: position.left,
        transform: 'translateX(-50%)',
        zIndex: 50,
      }
    : {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 50,
      };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/20 z-40"
        onClick={onDismiss}
      />
      
      {/* Popup */}
      <div
        ref={popupRef}
        style={popupStyle}
        className="bg-white rounded-lg shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[80vh] overflow-hidden"
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-slate-900 text-sm">
                {suggestion.insertAnchor && typeof suggestion.insertAnchor === 'object' && 'replaceSection' in suggestion.insertAnchor
                  ? 'Suggested Edit'
                  : suggestion.insertAnchor
                    ? 'Suggested Insertion'
                    : 'Suggested Edit'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {suggestion.sectionHeading ?? 'Selection'}
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              {stats.removed > 0 && (
                <span className="text-red-600 font-medium">
                  -{stats.removed} words
                </span>
              )}
              {stats.added > 0 && (
                <span className="text-green-600 font-medium">
                  +{stats.added} words
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Reason */}
        {suggestion.reason && (
          <div className="px-4 py-2 bg-blue-50 border-b border-blue-100">
            <p className="text-xs text-blue-700">
              <span className="font-medium">Reason:</span> {suggestion.reason}
            </p>
          </div>
        )}

        {/* Diff content: formatted markdown with diff spans (red strikethrough / green) */}
        <div className="px-4 py-4 overflow-y-auto max-h-[50vh] diff-popup-content">
          <div className="prose prose-sm max-w-none text-slate-800 leading-relaxed
            prose-p:my-2 prose-ul:my-2 prose-li:my-0 prose-ol:my-2
            prose-headings:font-semibold prose-headings:text-slate-900 prose-headings:mt-4 prose-headings:mb-2
            prose-strong:text-slate-900 prose-strong:font-semibold
            prose-pre:bg-slate-100 prose-pre:p-3 prose-pre:rounded-lg prose-pre:text-xs">
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
              {diffMarkdown || '(no changes)'}
            </ReactMarkdown>
          </div>
        </div>

        {/* Actions */}
        <div className="px-4 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Press <kbd className="px-1.5 py-0.5 bg-slate-200 rounded text-[10px] font-mono">Esc</kbd> to dismiss
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onReject}
              className="h-8 text-xs hover:bg-red-50 hover:border-red-300 hover:text-red-700"
            >
              <X className="w-3 h-3 mr-1.5" />
              Reject
            </Button>
            <Button
              size="sm"
              onClick={onAccept}
              className="h-8 text-xs bg-green-600 hover:bg-green-700 text-white"
            >
              <Check className="w-3 h-3 mr-1.5" />
              Accept
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

export default DiffPopup;
