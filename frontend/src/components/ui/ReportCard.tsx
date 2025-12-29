import { Badge } from "./badge";
import { Clock, ArrowRight, FileText } from "lucide-react";

interface Report {
  id: number;
  title: string;
  project: string;
  projectId: number;
  date: string;
  status: string;
  inspector: string;
  reviewer: string;
}

interface ReportCardProps {
  report: Report;
  onClick: () => void;
}

export function ReportCard({ report, onClick }: ReportCardProps) {
  return (
    <div
      className="group p-2 sm:p-3 border-2 border-theme-primary-30 bg-theme-primary-5 rounded-lg hover:bg-theme-primary-10 hover:border-theme-primary transition-all cursor-pointer"
      onClick={onClick}
    >
      {/* Single compact row with all content */}
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-theme-primary-10 rounded-md flex items-center justify-center flex-shrink-0 group-hover:bg-theme-primary-20 transition-colors">
          <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-theme-primary" />
        </div>
        
        {/* Left column: Title and metadata */}
        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          <h4 className="text-xs sm:text-sm text-slate-900 line-clamp-1 font-semibold">{report.title}</h4>
          <p className="text-[10px] sm:text-xs text-slate-600 line-clamp-1">{report.project}</p>
          <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-slate-500">
            <span className="line-clamp-1">{report.inspector}</span>
            <span className="hidden sm:inline">→</span>
            <span className="hidden sm:inline line-clamp-1">{report.reviewer}</span>
            <span className="hidden sm:inline">•</span>
            <span className="text-[10px] sm:text-xs text-slate-500">{report.date}</span>
          </div>
        </div>

        {/* Right column: Status badge */}
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <Badge 
            variant="secondary"
            className="text-[10px] rounded-md bg-theme-primary text-white h-5 px-1.5"
          >
            <Clock className="w-2.5 h-2.5 mr-0.5" />
            {report.status}
          </Badge>
        </div>

        <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-theme-primary group-hover:translate-x-1 transition-transform flex-shrink-0" />
      </div>
    </div>
  );
}