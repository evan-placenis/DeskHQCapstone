"use client";

import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";

export function DiffReviewBanner({
  onRejectDiff,
  onAcceptDiff,
}: {
  onRejectDiff?: () => void;
  onAcceptDiff?: () => void;
}) {
  return (
    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-blue-900">Review Mode</span>
          <span className="text-xs text-blue-700">Comparing changes...</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onRejectDiff}
            className="h-8 text-xs hover:bg-red-50 hover:border-red-300 hover:text-red-700"
          >
            <X className="w-3 h-3 mr-1.5" />
            Reject
          </Button>
          <Button size="sm" onClick={onAcceptDiff} className="h-8 text-xs bg-green-600 hover:bg-green-700 text-white">
            <Check className="w-3 h-3 mr-1.5" />
            Accept
          </Button>
        </div>
      </div>
    </div>
  );
}
