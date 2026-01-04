import { Project } from "../../App";
import { FolderOpen, Camera, FileText, ArrowRight, Clock, CheckCircle2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";

interface ProjectCardProps {
  project: Project;
  onClick: () => void;
  onStatusChange: (projectId: number, newStatus: string) => void;
}

export function ProjectCard({ project, onClick, onStatusChange }: ProjectCardProps) {
  const isCompleted = project.status === "Completed";
  
  return (
    <div
      className="group p-2 sm:p-4 border-2 border-slate-200 rounded-lg sm:rounded-xl hover:border-theme-primary hover:bg-theme-primary-5 transition-all cursor-pointer"
      onClick={onClick}
    >
      {/* Single compact row with all content */}
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="w-8 h-8 sm:w-12 sm:h-12 bg-theme-primary-10 rounded-md sm:rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-theme-primary-20 transition-colors">
          <FolderOpen className={`w-4 h-4 sm:w-6 sm:h-6 text-theme-primary ${
            isCompleted ? 'fill-theme-primary' : ''
          }`} />
        </div>
        
        {/* Left column: Title and metadata */}
        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          <h4 className="text-slate-900 text-[15px] sm:text-base line-clamp-1 leading-tight">
            {project.name}
          </h4>
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-[12px] sm:text-sm text-slate-600">
            <span className="flex items-center gap-0.5">
              <FileText className="w-3 h-3 sm:w-4 sm:h-4" />
              {project.reports}
            </span>
            <span className="flex items-center gap-0.5">
              <Camera className="w-3 h-3 sm:w-4 sm:h-4" />
              {project.photos}
            </span>
            <span className="text-[11px] sm:text-xs text-slate-500">• {project.lastUpdated}</span>
          </div>
        </div>
        
        {/* Right column: Status and arrow */}
        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <Select
            value={project.status}
            onValueChange={(value) => onStatusChange(project.id, value)}
          >
            <SelectTrigger className="w-[90px] sm:w-[120px] rounded-md sm:rounded-lg h-7 sm:h-8 text-[12px] sm:text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-lg">
              <SelectItem value="Active" className="rounded-md text-xs sm:text-sm">
                <div className="flex items-center gap-2">
                  <Clock className="w-3 h-3" />
                  Active
                </div>
              </SelectItem>
              <SelectItem value="Completed" className="rounded-md text-xs sm:text-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3 h-3" />
                  Completed
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
          <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400 group-hover:text-theme-primary group-hover:translate-x-1 transition-all flex-shrink-0" />
        </div>
      </div>
    </div>
  );
}