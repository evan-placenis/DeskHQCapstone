"use client";

import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";

export function InlineDiffAcceptBanner({
  onAcceptAll,
  onRejectAll,
}: {
  onAcceptAll: () => void;
  onRejectAll: () => void;
}) {
  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-3 shadow-2xl"
      role="status"
      aria-live="polite"
    >
      <span className="text-sm font-medium text-slate-700">AI changes applied — </span>
      <Button
        size="sm"
        onClick={onAcceptAll}
        className="h-8 bg-green-600 text-xs text-white hover:bg-green-700"
      >
        <Check className="mr-1.5 h-3 w-3" />
        Keep All Changes
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={onRejectAll}
        className="h-8 text-xs hover:border-red-300 hover:bg-red-50 hover:text-red-700"
      >
        <X className="mr-1.5 h-3 w-3" />
        Undo
      </Button>
    </div>
  );
}
