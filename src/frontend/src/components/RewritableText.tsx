import { useState } from "react";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Sparkles, X, Send } from "lucide-react";
import { EditableText } from "./EditableText";

interface RewritableTextProps {
  value: string;
  onChange: (value: string) => void;
  onRequestRewrite?: (currentText: string, instructions: string) => void;
  className?: string;
  multiline?: boolean;
  placeholder?: string;
  textClassName?: string;
  disabled?: boolean;
  onTextSelection?: (text: string) => void;
}

export function RewritableText({
  value,
  onChange,
  onRequestRewrite,
  className = "",
  multiline = false,
  placeholder = "",
  textClassName = "",
  disabled = false,
  onTextSelection
}: RewritableTextProps) {
  const [showRewriteInput, setShowRewriteInput] = useState(false);
  const [rewriteInstructions, setRewriteInstructions] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  const handleRewriteClick = () => {
    setShowRewriteInput(true);
  };

  const handleCancelRewrite = () => {
    setShowRewriteInput(false);
    setRewriteInstructions("");
  };

  const handleSubmitRewrite = () => {
    if (rewriteInstructions.trim() && onRequestRewrite) {
      onRequestRewrite(value, rewriteInstructions.trim());
      setShowRewriteInput(false);
      setRewriteInstructions("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      handleCancelRewrite();
    } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmitRewrite();
    }
  };

  return (
    <div 
      className="relative group"
      onFocus={() => setIsFocused(true)}
      onBlur={(e) => {
        // Don't hide if we're clicking the rewrite button or if rewrite input is showing
        if (!showRewriteInput) {
          setIsFocused(false);
        }
      }}
    >
      {/* Button - Show when focused/hovered and not in rewrite mode and not disabled */}
      {!showRewriteInput && !disabled && isFocused && onRequestRewrite && (
        <div className="absolute -top-3 right-0 z-10 animate-in fade-in slide-in-from-top-1 duration-200">
          <Button
            variant="default"
            size="sm"
            className="bg-theme-primary hover:bg-theme-primary-hover text-white rounded-lg shadow-lg h-7 px-2.5 text-xs border border-theme-primary-hover"
            onMouseDown={(e) => {
              e.preventDefault(); // Prevent blur from happening
              handleRewriteClick();
            }}
          >
            <Sparkles className="w-3.5 h-3.5 mr-1.5" />
            Rewrite with AI
          </Button>
        </div>
      )}

      {/* Main Content */}
      <EditableText
        value={value}
        onChange={onChange}
        className={className}
        multiline={multiline}
        placeholder={placeholder}
        textClassName={textClassName}
        disabled={disabled}
        onTextSelection={onTextSelection}
      />

      {/* Rewrite Input Box */}
      {showRewriteInput && (
        <div className="mt-3 p-4 bg-gradient-to-br from-theme-primary/5 to-theme-primary/10 border-2 border-theme-primary/30 rounded-xl space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-gradient-to-br from-theme-primary to-theme-primary-hover">
                <Sparkles className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-sm text-slate-900">
                Provide instructions for rewriting this text
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 hover:bg-white/60 rounded-md"
              onClick={handleCancelRewrite}
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>

          <Textarea
            value={rewriteInstructions}
            onChange={(e) => setRewriteInstructions(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="E.g., 'Make this more concise', 'Add technical details', 'Use a more formal tone'..."
            className="min-h-[80px] resize-none rounded-lg border-slate-300 focus:border-theme-primary focus:ring-theme-primary bg-white text-sm"
            autoFocus
          />

          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">
              Press <kbd className="px-1.5 py-0.5 bg-slate-200 rounded text-xs">⌘</kbd> + <kbd className="px-1.5 py-0.5 bg-slate-200 rounded text-xs">Enter</kbd> to submit
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-lg h-8 text-xs"
                onClick={handleCancelRewrite}
              >
                Cancel
              </Button>
              <Button
                variant="default"
                size="sm"
                className="bg-gradient-to-r from-theme-primary to-theme-primary-hover hover:from-theme-primary-hover hover:to-theme-primary text-white rounded-lg h-8 text-xs"
                onClick={handleSubmitRewrite}
                disabled={!rewriteInstructions.trim()}
              >
                <Send className="w-3 h-3 mr-1.5" />
                Request Rewrite
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}