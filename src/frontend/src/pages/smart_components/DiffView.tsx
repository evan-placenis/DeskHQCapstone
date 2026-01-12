"use client";

import { Button } from "../ui_components/button";
import { Check, X, Sparkles, UserCheck } from "lucide-react";
import { diffWords, Change } from "diff";

interface DiffViewProps {
  oldText: string;
  newText: string;
  changes?: Change[]; // 🟢 Added
  stats?: { changeSummary: string }; // 🟢 Added
  onAccept: () => void;
  onReject: () => void;
  sectionTitle?: string;
  source?: "ai" | "peer-review";
}

export function DiffView({
  oldText,
  newText,
  changes, // 🟢 New prop
  stats,   // 🟢 New prop
  onAccept,
  onReject,
  sectionTitle,
  source = "ai"
}: DiffViewProps) {
  // 🟢 Use backend-provided diffs if available, otherwise compute them
  const differences = changes || diffWords(oldText, newText);
  
  const isPeerReview = source === "peer-review";

  return (
    <div className={`border-2 ${isPeerReview ? 'border-theme-primary-30 bg-theme-primary-lighter' : 'border-blue-300 bg-blue-50/50'} rounded-lg p-4 space-y-3`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isPeerReview ? (
            <UserCheck className="w-4 h-4 text-theme-primary" />
          ) : (
            <Sparkles className="w-4 h-4 text-blue-600" />
          )}
          <span className={`text-sm ${isPeerReview ? 'text-theme-secondary' : 'text-blue-900'}`}>
            {isPeerReview ? 'Peer Review' : 'AI'} suggested changes{sectionTitle ? ` for "${sectionTitle}"` : ""}
            {stats && ( // 🟢 Display Stats Badge
              <span className="ml-2 text-xs bg-white/50 px-2 py-0.5 rounded-full border border-blue-200">
                {stats.changeSummary}
              </span>
            )}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={onReject}
            className="rounded-lg hover:bg-red-50 hover:border-red-300 hover:text-red-700"
          >
            <X className="w-3 h-3 mr-1" />
            Reject
          </Button>
          <Button
            size="sm"
            onClick={onAccept}
            className="rounded-lg bg-green-600 hover:bg-green-700"
          >
            <Check className="w-3 h-3 mr-1" />
            Accept
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-lg p-4 border border-slate-200">
        <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">
          {differences.map((part: Change, index: number) => {
            if (part.added) {
              return (
                <span
                  key={index}
                  className="bg-green-200 text-green-900 px-1 rounded"
                >
                  {part.value}
                </span>
              );
            } else if (part.removed) {
              return (
                <span
                  key={index}
                  className="bg-red-200 text-red-900 line-through px-1 rounded"
                >
                  {part.value}
                </span>
              );
            } else {
              return <span key={index}>{part.value}</span>;
            }
          })}
        </p>
      </div>

      <div className="flex items-start gap-2 text-xs text-slate-600">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-green-200 rounded"></div>
          <span>Added text</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-red-200 rounded"></div>
          <span>Removed text</span>
        </div>
      </div>
    </div>
  );
}