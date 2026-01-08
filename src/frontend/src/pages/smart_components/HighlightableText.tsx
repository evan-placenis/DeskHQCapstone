"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "../ui_components/button";
import { Textarea } from "../ui_components/textarea";
import { Badge } from "../ui_components/badge";
import { MessageSquare, AlertCircle, X, Edit } from "lucide-react";
import { PeerReviewComment } from "@/frontend/types";

interface Highlight {
  id: number;
  start: number;
  end: number;
  text: string;
  commentId?: number;
}

interface HighlightableTextProps {
  content: string;
  sectionId: number | string;
  isEditing?: boolean;
  comments: PeerReviewComment[];
  onAddHighlightComment?: (highlightedText: string, sectionId: number | string, comment: string, type: "comment" | "suggestion" | "issue") => void;
  onAddHighlightEdit?: (highlightedText: string, sectionId: number | string, newText: string) => void;
  onHighlightClick?: (commentId: number) => void;
  activeCommentId?: number | null;
  disabled?: boolean;
  onTextSelection?: (text: string) => void;
}

export function HighlightableText({ 
  content, 
  sectionId,
  isEditing = false,
  comments,
  onAddHighlightComment,
  onAddHighlightEdit,
  onHighlightClick,
  activeCommentId,
  disabled = false,
  onTextSelection
}: HighlightableTextProps) {
  const [selection, setSelection] = useState<{ start: number; end: number; text: string } | null>(null);
  const [commentType, setCommentType] = useState<"comment" | "suggestion" | "issue">("comment");
  const [commentText, setCommentText] = useState("");
  const [editText, setEditText] = useState("");
  const [isEditMode, setIsEditMode] = useState(false);
  const [popupPosition, setPopupPosition] = useState<{ top: number; left: number } | null>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // Get highlights from comments associated with this section
  const highlights: Highlight[] = comments
    .filter(c => c.sectionId === sectionId && c.highlightedText && !c.resolved)
    .map(c => {
      const start = content.indexOf(c.highlightedText!);
      return {
        id: c.id,
        start,
        end: start + c.highlightedText!.length,
        text: c.highlightedText!,
        commentId: c.id
      };
    })
    .filter(h => h.start !== -1);

  const handleMouseUp = () => {
    // If disabled (AI selection mode), handle text selection for AI chat
    if (disabled && onTextSelection) {
      setTimeout(() => {
        if (typeof window !== "undefined") {
          const sel = window.getSelection();
          const selectedText = sel?.toString().trim() || "";
          if (selectedText) {
            onTextSelection(selectedText);
            sel?.removeAllRanges();
          }
        }
      }, 10);
      return;
    }

    // Otherwise, handle normal peer review highlighting
    if (isEditing || !onAddHighlightComment) return;

    if (typeof window !== "undefined") {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;

      const selectedText = sel.toString().trim();

      if (selectedText.length === 0) {
        setSelection(null);
        setContextMenuPosition(null);
        return;
      }

      // Store the selection for later use
      const range = sel.getRangeAt(0);
      if (contentRef.current?.contains(range.commonAncestorContainer)) {
        setSelection({
          start: 0,
          end: 0,
          text: selectedText
        });
      }
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    if (isEditing || !onAddHighlightComment) return;

    if (typeof window !== "undefined") {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;

      const selectedText = sel.toString().trim();

      if (selectedText.length === 0) {
        return;
      }

      // Check if selection is within our content
      const range = sel.getRangeAt(0);
      if (!contentRef.current?.contains(range.commonAncestorContainer)) {
        return;
      }

      e.preventDefault();

      // Calculate position for context menu
      const containerRect = contentRef.current.getBoundingClientRect();
      
      setSelection({
        start: 0,
        end: 0,
        text: selectedText
      });

      setContextMenuPosition({
        top: e.clientY - containerRect.top,
        left: e.clientX - containerRect.left
      });
    }
  };

  const handleCommentClick = () => {
    if (!selection) return;

    // Close context menu and open comment popup
    setContextMenuPosition(null);
    setIsEditMode(false);

    // Calculate position for popup near the selection
    if (typeof window !== "undefined") {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && contentRef.current) {
        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        const containerRect = contentRef.current.getBoundingClientRect();

        setPopupPosition({
          top: rect.bottom - containerRect.top + 8,
          left: rect.left - containerRect.left
        });
      }
    }
  };

  const handleEditClick = () => {
    if (!selection) return;

    // Close context menu and open edit popup with pre-filled text
    setContextMenuPosition(null);
    setIsEditMode(true);
    setEditText(selection.text); // Pre-fill with selected text

    // Calculate position for popup near the selection
    if (typeof window !== "undefined") {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && contentRef.current) {
        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        const containerRect = contentRef.current.getBoundingClientRect();

        setPopupPosition({
          top: rect.bottom - containerRect.top + 8,
          left: rect.left - containerRect.left
        });
      }
    }
  };

  const handleAddComment = () => {
    if (!selection || !commentText.trim() || !onAddHighlightComment) return;

    onAddHighlightComment(selection.text, sectionId, commentText, commentType);
    
    // Reset state
    setSelection(null);
    setCommentText("");
    setCommentType("comment");
    setPopupPosition(null);
    
    // Clear selection
    if (typeof window !== "undefined") {
      window.getSelection()?.removeAllRanges();
    }
  };

  const handleAddEdit = () => {
    if (!selection || !editText.trim() || !onAddHighlightEdit) return;

    onAddHighlightEdit(selection.text, sectionId, editText);
    
    // Reset state
    setSelection(null);
    setEditText("");
    setPopupPosition(null);
    
    // Clear selection
    if (typeof window !== "undefined") {
      window.getSelection()?.removeAllRanges();
    }
  };

  const handleCancel = () => {
    setSelection(null);
    setCommentText("");
    setEditText("");
    setPopupPosition(null);
    if (typeof window !== "undefined") {
      window.getSelection()?.removeAllRanges();
    }
  };

  // Close popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        handleCancel();
      }
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
        setContextMenuPosition(null);
      }
    };

    if (popupPosition || contextMenuPosition) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [popupPosition, contextMenuPosition]);

  // Render text with highlights
  const renderContent = () => {
    if (highlights.length === 0) {
      return <p className="whitespace-pre-wrap">{content}</p>;
    }

    // Sort highlights by start position
    const sortedHighlights = [...highlights].sort((a, b) => a.start - b.start);
    const parts: any[] = [];
    let lastIndex = 0;

    sortedHighlights.forEach((highlight, idx) => {
      // Add text before highlight
      if (highlight.start > lastIndex) {
        parts.push(
          <span key={`text-${idx}`}>
            {content.substring(lastIndex, highlight.start)}
          </span>
        );
      }

      // Add highlighted text
      const isActive = activeCommentId === highlight.commentId;
      const comment = comments.find(c => c.id === highlight.commentId);
      const bgColor = 
        comment?.type === "issue" ? "bg-red-100 hover:bg-red-200" :
        comment?.type === "suggestion" ? "bg-blue-100 hover:bg-blue-200" :
        "bg-yellow-100 hover:bg-yellow-200";

      parts.push(
        <span
          key={`highlight-${idx}`}
          className={`${bgColor} ${isActive ? 'ring-2 ring-primary' : ''} cursor-pointer transition-colors rounded-sm px-0.5`}
          onClick={() => onHighlightClick?.(highlight.commentId!)}
          title="Click to view comment"
        >
          {highlight.text}
        </span>
      );

      lastIndex = highlight.end;
    });

    // Add remaining text
    if (lastIndex < content.length) {
      parts.push(
        <span key="text-end">
          {content.substring(lastIndex)}
        </span>
      );
    }

    return <p className="whitespace-pre-wrap">{parts}</p>;
  };

  return (
    <div className="relative">
      <div
        ref={contentRef}
        onMouseUp={handleMouseUp}
        onContextMenu={handleContextMenu}
        className={!isEditing && onAddHighlightComment ? "select-text cursor-text" : ""}
      >
        {renderContent()}
      </div>

      {/* Comment Popup */}
      {popupPosition && selection && onAddHighlightComment && (
        <div
          ref={popupRef}
          className="absolute z-50 bg-white border-2 border-slate-200 rounded-lg shadow-xl p-4 w-80"
          style={{
            top: `${popupPosition.top}px`,
            left: `${popupPosition.left}px`,
          }}
        >
          <div className="space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-xs text-slate-500 mb-1">Selected text:</p>
                <p className="text-sm text-slate-700 italic bg-yellow-50 p-2 rounded border border-yellow-200 line-clamp-2">
                  "{selection.text}"
                </p>
              </div>
              <button
                onClick={handleCancel}
                className="ml-2 p-1 hover:bg-slate-100 rounded"
              >
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant={commentType === "comment" ? "default" : "outline"}
                size="sm"
                onClick={() => setCommentType("comment")}
                className="rounded-lg flex-1"
              >
                <MessageSquare className="w-3 h-3 mr-1" />
                Comment
              </Button>
              <Button
                type="button"
                variant={commentType === "suggestion" ? "default" : "outline"}
                size="sm"
                onClick={() => setCommentType("suggestion")}
                className={`rounded-lg flex-1 ${
                  commentType === "suggestion"
                    ? "bg-blue-600 hover:bg-blue-700"
                    : ""
                }`}
              >
                <MessageSquare className="w-3 h-3 mr-1" />
                Suggest
              </Button>
              <Button
                type="button"
                variant={commentType === "issue" ? "default" : "outline"}
                size="sm"
                onClick={() => setCommentType("issue")}
                className={`rounded-lg flex-1 ${
                  commentType === "issue"
                    ? "bg-red-600 hover:bg-red-700"
                    : ""
                }`}
              >
                <AlertCircle className="w-3 h-3 mr-1" />
                Issue
              </Button>
            </div>

            <Textarea
              placeholder={`Add your ${commentType}...`}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              className="rounded-lg resize-none"
              rows={3}
              autoFocus
            />

            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancel}
                className="rounded-lg"
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddComment}
                disabled={!commentText.trim()}
                className="bg-theme-primary hover:bg-theme-primary-hover text-white rounded-lg"
                size="sm"
              >
                Add {commentType}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Popup */}
      {popupPosition && selection && onAddHighlightEdit && isEditMode && (
        <div
          ref={popupRef}
          className="absolute z-50 bg-white border-2 border-slate-200 rounded-lg shadow-xl p-4 w-80"
          style={{
            top: `${popupPosition.top}px`,
            left: `${popupPosition.left}px`,
          }}
        >
          <div className="space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-xs text-slate-500 mb-1">Selected text:</p>
                <p className="text-sm text-slate-700 italic bg-yellow-50 p-2 rounded border border-yellow-200 line-clamp-2">
                  "{selection.text}"
                </p>
              </div>
              <button
                onClick={handleCancel}
                className="ml-2 p-1 hover:bg-slate-100 rounded"
              >
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            <Textarea
              placeholder="Edit the selected text..."
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="rounded-lg resize-none"
              rows={3}
              autoFocus
            />

            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancel}
                className="rounded-lg"
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddEdit}
                disabled={!editText.trim()}
                className="bg-theme-primary hover:bg-theme-primary-hover rounded-lg"
                size="sm"
              >
                Save Edit
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Context Menu */}
      {contextMenuPosition && selection && (onAddHighlightComment || onAddHighlightEdit) && (
        <div
          ref={contextMenuRef}
          className="absolute z-50 bg-white border border-slate-300 rounded-lg shadow-lg py-1"
          style={{
            top: `${contextMenuPosition.top}px`,
            left: `${contextMenuPosition.left}px`,
          }}
        >
          {onAddHighlightComment && (
            <button
              onClick={handleCommentClick}
              className="w-full px-4 py-2 text-left text-sm hover:bg-slate-100 flex items-center gap-2"
            >
              <MessageSquare className="w-4 h-4" />
              Comment
            </button>
          )}
          {onAddHighlightEdit && (
            <button
              onClick={handleEditClick}
              className="w-full px-4 py-2 text-left text-sm hover:bg-slate-100 flex items-center gap-2"
            >
              <Edit className="w-4 h-4" />
              Edit
            </button>
          )}
        </div>
      )}
    </div>
  );
}
