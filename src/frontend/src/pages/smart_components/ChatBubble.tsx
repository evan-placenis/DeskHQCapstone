import React from 'react';
import { User, Bot, Check, X, Sparkles, FileText } from 'lucide-react';
import { Button } from "../ui_components/button";
import { Card } from "../ui_components/card";

// --- Interfaces (matching the prompt) ---

export interface EditSuggestion {
  id: string;
  targetSectionId: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  stats: {
    added: number;
    removed: number;
    changeSummary: string;
  };
  changes: { 
    value: string; 
    added?: boolean; 
    removed?: boolean 
  }[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  suggestion?: EditSuggestion;
  timestamp: Date;
}

interface ChatBubbleProps {
  message: ChatMessage;
  onAcceptSuggestion?: (suggestionId: string) => void;
  onRejectSuggestion?: (suggestionId: string) => void;
}

// --- Suggestion Card Component ---

const SuggestionCard = ({ 
  suggestion, 
  onAccept, 
  onReject 
}: { 
  suggestion: EditSuggestion; 
  onAccept?: (id: string) => void; 
  onReject?: (id: string) => void; 
}) => {
  return (
    <Card className="mt-3 border border-slate-200 shadow-sm overflow-hidden bg-white/50">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-blue-600" />
          <span className="text-xs font-medium text-slate-700">Suggested Edit</span>
        </div>
        {suggestion.stats && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200">
            {suggestion.stats.changeSummary}
          </span>
        )}
      </div>

      {/* Diff View */}
      <div className="p-3 text-sm leading-relaxed font-mono bg-white text-slate-700">
        {suggestion.changes.map((part, index) => {
          if (part.added) {
            return (
              <span key={index} className="bg-green-100 text-green-800 px-0.5 rounded mx-0.5 decoration-clone">
                {part.value}
              </span>
            );
          } else if (part.removed) {
            return (
              <span key={index} className="bg-red-100 text-red-800 line-through px-0.5 rounded mx-0.5 decoration-clone opacity-70">
                {part.value}
              </span>
            );
          }
          return <span key={index}>{part.value}</span>;
        })}
      </div>

      {/* Footer Actions */}
      <div className="flex items-center gap-2 p-2 bg-slate-50 border-t border-slate-100">
        <Button 
          size="sm" 
          variant="outline" 
          className="flex-1 h-8 text-xs hover:bg-red-50 hover:text-red-600 hover:border-red-200"
          onClick={() => {
            console.log("Rejected suggestion:", suggestion.id);
            onReject?.(suggestion.id);
          }}
        >
          <X className="w-3 h-3 mr-1.5" />
          Reject
        </Button>
        <Button 
          size="sm" 
          className="flex-1 h-8 text-xs bg-green-600 hover:bg-green-700 text-white"
          onClick={() => {
            console.log("Accepted suggestion:", suggestion.id);
            onAccept?.(suggestion.id);
          }}
        >
          <Check className="w-3 h-3 mr-1.5" />
          Accept
        </Button>
      </div>
    </Card>
  );
};

// --- Chat Bubble Component ---

export const ChatBubble = ({ message, onAcceptSuggestion, onRejectSuggestion }: ChatBubbleProps) => {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';

  return (
    <div className={`flex gap-3 mb-4 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {/* Avatar */}
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center shadow-sm ${
        isAssistant 
          ? "bg-gradient-to-br from-[#3c6e71] to-[#2d5456] text-white ring-2 ring-[#3c6e71]/20" 
          : "bg-slate-200 text-slate-600"
      }`}>
        {isAssistant ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
      </div>

      {/* Bubble Content */}
      <div className={`flex flex-col max-w-[85%] sm:max-w-[75%] ${isUser ? "items-end" : "items-start"}`}>
        
        {/* Text Bubble */}
        <div className={`rounded-xl px-4 py-3 shadow-sm text-sm whitespace-pre-wrap break-words ${
          isAssistant
            ? "bg-white border border-slate-200 text-slate-800"
            : "bg-gradient-to-br from-[#3c6e71] to-[#2d5456] text-white"
        }`}>
          {message.content}
        </div>

        {/* Suggestion Card REMOVED as per user request (moved to Report View) */}

        {/* Timestamp */}
        <div className="text-[10px] text-slate-400 mt-1 px-1">
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
};
