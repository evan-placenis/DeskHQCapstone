"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from 'react-markdown';
import { Textarea } from "../ui_components/textarea";
import { Input } from "../ui_components/input";

interface EditableTextProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  multiline?: boolean;
  placeholder?: string;
  textClassName?: string;
  disabled?: boolean;
  onTextSelection?: (text: string) => void;
  markdown?: boolean;
}

export function EditableText({
  value,
  onChange,
  className = "",
  multiline = false,
  placeholder = "",
  textClassName = "",
  disabled = false,
  onTextSelection,
  markdown = false
}: EditableTextProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  useEffect(() => {
    if (isEditing) {
      if (multiline && textareaRef.current) {
        textareaRef.current.focus();
        // Auto-resize textarea
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
      } else if (!multiline && inputRef.current) {
        inputRef.current.focus();
      }
    }
  }, [isEditing, multiline]);

  const handleSave = () => {
    if (editValue !== value) {
      onChange(editValue);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!multiline && e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      setEditValue(value);
      setIsEditing(false);
    }
  };

  const handleMouseUp = () => {
    if (onTextSelection) {
      // Add a small delay to ensure selection is complete
      setTimeout(() => {
        const selectedText = (typeof window !== "undefined" ? window.getSelection()?.toString().trim() : "") || "";
        if (selectedText) {
          onTextSelection(selectedText);
        }
      }, 10);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    if (disabled) {
      // Prevent any click action in disabled mode to allow selection
      e.stopPropagation();
      return;
    }
    setIsEditing(true);
  };

  if (isEditing && !disabled) {
    if (multiline) {
      return (
        <Textarea
          ref={textareaRef}
          value={editValue}
          onChange={(e) => {
            setEditValue(e.target.value);
            // Auto-resize
            e.target.style.height = 'auto';
            e.target.style.height = e.target.scrollHeight + 'px';
          }}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className={`min-h-[80px] resize-none rounded-lg ${className}`}
          placeholder={placeholder}
        />
      );
    } else {
      return (
        <Input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className={`rounded-lg ${className}`}
          placeholder={placeholder}
        />
      );
    }
  }

  return (
    <div
      onClick={handleClick}
      onMouseUp={handleMouseUp}
      className={`${disabled ? 'cursor-text select-text hover:bg-blue-50/30' : 'cursor-text hover:bg-slate-50'} rounded px-2 py-1 -mx-2 -my-1 transition-colors ${textClassName}`}
      style={disabled ? { userSelect: 'text', WebkitUserSelect: 'text', MozUserSelect: 'text', msUserSelect: 'text' } as React.CSSProperties : undefined}
    >
      {value ? (
        markdown ? (
          <div className="prose prose-sm prose-slate max-w-none">
            <ReactMarkdown>{value}</ReactMarkdown>
          </div>
        ) : (
          value
        )
      ) : (
        <span className="text-slate-400 italic">{placeholder}</span>
      )}
    </div>
  );
}