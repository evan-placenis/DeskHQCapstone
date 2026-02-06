"use client";

import { useEffect, useRef, useMemo } from 'react';
import { diff_match_patch, Diff } from 'diff-match-patch';
import { Button } from '../ui_components/button';
import { Check, X } from 'lucide-react';

/**
 * EditSuggestion type - matches the backend definition
 */
export interface EditSuggestion {
  sectionRowId: string;    // UUID primary key from report_sections.id (for DB updates)
  sectionId: string;       // Template category like "exec-summary" (for context)
  sectionHeading: string;
  originalText: string;
  suggestedText: string;
  reason: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
}

interface DiffPopupProps {
  suggestion: EditSuggestion;
  position?: { top: number; left: number };
  onAccept: () => void;
  onReject: () => void;
  onDismiss?: () => void;
}

/**
 * DiffPopup - Cursor-style floating overlay for reviewing AI edit suggestions
 * 
 * Uses Google's diff-match-patch library to compute and display diffs.
 * Shows deletions in red with strikethrough, additions in green.
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

  // Compute the diff using diff-match-patch
  const diffs = useMemo(() => {
    const dmp = new diff_match_patch();
    const result = dmp.diff_main(suggestion.originalText, suggestion.suggestedText);
    dmp.diff_cleanupSemantic(result);
    return result;
  }, [suggestion.originalText, suggestion.suggestedText]);

  // Calculate stats
  const stats = useMemo(() => {
    let added = 0;
    let removed = 0;

    for (const [op, text] of diffs) {
      const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
      if (op === 1) added += wordCount;
      if (op === -1) removed += wordCount;
    }

    return { added, removed };
  }, [diffs]);

  // Render diff with styling
  const renderDiff = (diffs: Diff[]) => {
    return diffs.map(([op, text], index) => {
      // Handle newlines by preserving them
      const parts = text.split('\n');
      
      return parts.map((part, partIndex) => {
        const isLastPart = partIndex === parts.length - 1;
        const key = `${index}-${partIndex}`;

        if (op === -1) {
          // Deletion - red background with strikethrough
          return (
            <span key={key}>
              <del className="bg-red-100 text-red-800 px-0.5 rounded-sm line-through decoration-red-500">
                {part}
              </del>
              {!isLastPart && <br />}
            </span>
          );
        }
        
        if (op === 1) {
          // Addition - green background
          return (
            <span key={key}>
              <ins className="bg-green-100 text-green-800 px-0.5 rounded-sm no-underline">
                {part}
              </ins>
              {!isLastPart && <br />}
            </span>
          );
        }
        
        // Unchanged text
        return (
          <span key={key}>
            {part}
            {!isLastPart && <br />}
          </span>
        );
      });
    });
  };

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
                Suggested Edit
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {suggestion.sectionHeading}
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

        {/* Diff Content */}
        <div className="px-4 py-4 overflow-y-auto max-h-[50vh]">
          <div className="prose prose-sm max-w-none text-slate-800 leading-relaxed whitespace-pre-wrap font-mono text-xs">
            {renderDiff(diffs)}
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
