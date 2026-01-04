import { Badge } from "../ui/badge";
import { CalendarClock } from "lucide-react";

interface UpcomingReview {
  id: number;
  title: string;
  project: string;
  projectId: number;
  expectedDate: string;
  inspector: string;
  reviewer: string;
  confidence: string;
}

interface UpcomingReviewCardProps {
  review: UpcomingReview;
}

export function UpcomingReviewCard({ review }: UpcomingReviewCardProps) {
  return (
    <div className="group p-2 sm:p-3 border-2 border-theme-secondary-30 bg-theme-secondary-5 rounded-lg hover:bg-theme-secondary-10 hover:border-theme-secondary-30 transition-all">
      {/* Single compact row with all content */}
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-theme-secondary-10 rounded-md flex items-center justify-center flex-shrink-0 group-hover:bg-theme-secondary-20 transition-colors">
          <CalendarClock className="w-4 h-4 sm:w-5 sm:h-5 text-theme-secondary" />
        </div>
        
        {/* Left column: Title and metadata */}
        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          <h4 className="text-xs sm:text-sm text-slate-900 line-clamp-1 font-semibold">{review.title}</h4>
          <p className="text-[10px] sm:text-xs text-slate-600 line-clamp-1">{review.project}</p>
          <div className="flex items-center gap-1 text-[10px] sm:text-xs text-slate-500">
            <span className="line-clamp-1">{review.inspector}</span>
            <span className="hidden sm:inline">→</span>
            <span className="hidden sm:inline line-clamp-1">{review.reviewer}</span>
          </div>
        </div>

        {/* Right column: Date and confidence badge */}
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <span className="text-[10px] sm:text-xs text-slate-500">{review.expectedDate}</span>
          <Badge 
            variant="secondary"
            className={`text-[10px] rounded-md h-5 px-1.5 ${
              review.confidence === "High" 
                ? "bg-theme-secondary text-white" 
                : "bg-theme-gray-light text-theme-gray-dark"
            }`}
          >
            {review.confidence}
          </Badge>
        </div>

        <CalendarClock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-theme-secondary flex-shrink-0" />
      </div>
    </div>
  );
}
