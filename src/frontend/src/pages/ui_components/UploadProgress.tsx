import React from "react";
import { Loader2 } from "lucide-react";

interface UploadProgressProps {
  progress: number;
  label?: string;
  isUploading: boolean;
}

export function UploadProgress({ progress, label = "Uploading...", isUploading }: UploadProgressProps) {
  if (!isUploading) return null;

  return (
    <div className="mb-6 p-4 bg-blue-50 border border-blue-100 rounded-lg flex items-center gap-4">
      <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      <div className="flex-1">
        <div className="flex justify-between mb-1">
          <span className="text-sm font-medium text-blue-700">{label}</span>
          <span className="text-sm font-medium text-blue-700">{progress}%</span>
        </div>
        <div className="w-full bg-blue-200 rounded-full h-2.5">
          <div
            className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
}

