"use client";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ReportContent as ReportContentType } from "@/lib/types";
import { ArrowLeft, Download, Calendar, MapPin, UserCheck, Save, User } from "lucide-react";

export function ReportDocumentHeader({
  backLabel,
  onBack,
  reportContent,
  reportStatus,
  onStatusChange,
  mode,
  onRequestPeerReview,
  showSaveButton,
  onSave,
  onExport,
}: {
  backLabel: string;
  onBack: () => void;
  reportContent: ReportContentType;
  reportStatus: string;
  onStatusChange: (status: string) => void;
  mode: "edit" | "peer-review";
  onRequestPeerReview?: () => void;
  showSaveButton: boolean;
  onSave?: () => void;
  onExport?: () => void;
}) {
  return (
    <div className="bg-white border-b border-slate-200 p-3 sm:p-6 flex-shrink-0">
      <Button
        variant="ghost"
        size="sm"
        className="mb-2 sm:mb-3 -ml-2 rounded-lg text-xs sm:text-sm h-8 sm:h-auto"
        onClick={onBack}
      >
        <ArrowLeft className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
        {backLabel}
      </Button>

      <div className="flex flex-col sm:flex-row items-start justify-between gap-3 sm:gap-0">
        <div className="flex-1 min-w-0">
          <h1 className="text-slate-900 mb-2 text-base sm:text-xl truncate">{reportContent.title}</h1>
          <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-slate-600">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3 sm:w-4 sm:h-4" />
              {reportContent.date}
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3 sm:w-4 sm:h-4" />
              {reportContent.location}
            </span>
            <span className="flex items-center gap-1">
              <User className="w-3 h-3 sm:w-4 sm:h-4" />
              {reportContent.engineer}
            </span>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
          <Select value={reportStatus} onValueChange={onStatusChange}>
            <SelectTrigger className="rounded-lg text-xs sm:text-sm h-8 sm:h-10 w-full sm:w-auto">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Draft">Draft</SelectItem>
              <SelectItem value="Under Review">Under Review</SelectItem>
              <SelectItem value="Completed">Completed</SelectItem>
            </SelectContent>
          </Select>
          {mode === "edit" && onRequestPeerReview && (
            <Button
              variant="outline"
              className="rounded-lg text-xs sm:text-sm h-8 sm:h-10"
              onClick={onRequestPeerReview}
            >
              <UserCheck className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
              Request Review
            </Button>
          )}
          {showSaveButton && onSave && (
            <Button
              className="bg-theme-success hover:bg-theme-success-hover rounded-lg text-xs sm:text-sm h-8 sm:h-10"
              onClick={onSave}
            >
              <Save className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
              Save
            </Button>
          )}
          {onExport && (
            <Button variant="default" className="rounded-lg text-xs sm:text-sm h-8 sm:h-10" onClick={onExport}>
              <Download className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
              Export PDF
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
