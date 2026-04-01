import { Badge } from "@/components/ui/badge";
import { Clock, ArrowRight, FileText } from "lucide-react";
import { Report } from "@/lib/types";

interface ReportCardProps {
  report: Report;
  onClick?: () => void;
  onSelectReport?: (reportId: number | string) => void;
  /** Compact variant for dashboard RHS column - shorter height, tighter padding */
  compact?: boolean;
}

export function ReportCard({ report, onClick, onSelectReport, compact }: ReportCardProps) {
  const handleClick = onSelectReport ? () => onSelectReport(report.id) : onClick;

  return (
    <div
      className={`group border-2 border-theme-primary-30 bg-theme-primary-5 rounded-lg hover:bg-theme-primary-10 hover:border-theme-primary transition-all cursor-pointer ${
        compact ? "p-1.5 sm:p-2" : "p-2 sm:p-3"
      }`}
      onClick={handleClick}
    >
      {/* Single compact row with all content */}
      <div className={`flex items-center ${compact ? "gap-1.5 sm:gap-2" : "gap-2 sm:gap-3"}`}>
        <div className={`bg-theme-primary-10 rounded-md flex items-center justify-center flex-shrink-0 group-hover:bg-theme-primary-20 transition-colors ${
          compact ? "w-6 h-6 sm:w-8 sm:h-8" : "w-8 h-8 sm:w-10 sm:h-10"
        }`}>
          <FileText className={`text-theme-primary ${compact ? "w-3 h-3 sm:w-4 sm:h-4" : "w-4 h-4 sm:w-5 sm:h-5"}`} />
        </div>
        
        {/* Left column: Title and metadata */}
        <div className="flex-1 min-w-0 flex flex-col gap-0">
          <h4 className={`text-slate-900 line-clamp-1 font-semibold ${compact ? "text-[11px] sm:text-xs" : "text-xs sm:text-sm"}`}>{report.title}</h4>
          <p className={`text-slate-600 line-clamp-1 ${compact ? "text-[9px] sm:text-[10px]" : "text-[10px] sm:text-xs"}`}>{report.project}</p>
          <div className={`flex items-center gap-1 text-slate-500 ${compact ? "text-[9px] sm:text-[10px]" : "text-[10px] sm:text-xs"}`}>
            <span className="line-clamp-1">{report.inspector}</span>
            <span className="hidden sm:inline">→</span>
            <span className="hidden sm:inline line-clamp-1">{report.reviewer}</span>
            <span className="hidden sm:inline">•</span>
            <span>{report.date}</span>
          </div>
        </div>

        {/* Right column: Status badge */}
        <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
          <Badge 
            variant="secondary"
            className={`rounded-md bg-theme-primary text-white px-1.5 ${
              compact ? "text-[9px] h-4" : "text-[10px] h-5"
            }`}
          >
            <Clock className={`mr-0.5 ${compact ? "w-2 h-2" : "w-2.5 h-2.5"}`} />
            {report.status}
          </Badge>
        </div>

        <ArrowRight className={`text-theme-primary group-hover:translate-x-1 transition-transform flex-shrink-0 ${
          compact ? "w-3 h-3 sm:w-3.5 sm:h-3.5" : "w-3.5 h-3.5 sm:w-4 sm:h-4"
        }`} />
      </div>
    </div>
  );
}