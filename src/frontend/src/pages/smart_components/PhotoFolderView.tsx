"use client";

import { Badge } from "../ui_components/badge";
import { Button } from "../ui_components/button";
import { ImageWithFallback } from "../figma/ImageWithFallback";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../ui_components/collapsible";
import { 
  Calendar, 
  Eye, 
  Trash2, 
  ChevronDown, 
  FolderOpen,
  Check,
  Volume2
} from "lucide-react";
import { Photo, PhotoFolder } from "@/frontend/types";

interface PhotoFolderViewProps {
  folders: PhotoFolder[];
  photos: Photo[];
  mode: "view" | "select";
  
  // For view mode
  onPhotoClick?: (photo: Photo) => void;
  onDeletePhoto?: (photoId: number) => void;
  onDeleteFolder?: (folderId: number) => void;
  onAudioTimelineClick?: (folderId: number) => void;
  
  // For select mode
  selectedPhotoIds?: number[];
  onTogglePhoto?: (photoId: number) => void;
  
  // Grid size control
  gridSize?: number;
  onGridSizeChange?: (size: number) => void;
}

export function PhotoFolderView({
  folders,
  photos,
  mode,
  onPhotoClick,
  onDeletePhoto,
  onDeleteFolder,
  onAudioTimelineClick,
  selectedPhotoIds = [],
  onTogglePhoto,
  gridSize = 2,
  onGridSizeChange,
}: PhotoFolderViewProps) {
  
  // Define grid classes based on gridSize
  const getGridCols = () => {
    switch (gridSize) {
      case 0: return "grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10"; // XS
      case 1: return "grid-cols-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8"; // S
      case 2: return "grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6"; // M (current default)
      case 3: return "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"; // L
      default: return "grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6";
    }
  };
  
  return (
    <div className="space-y-3">
      {folders.map((folder) => {
        const folderPhotos = photos.filter(p => p.folderId === folder.id);
        
        return (
          <Collapsible key={folder.id} defaultOpen>
            <div className="border-2 border-slate-200 rounded-xl overflow-hidden hover:border-theme-hover-border transition-all">
              {/* Folder Header */}
              <div className="p-2.5 sm:p-4 bg-slate-50 hover:bg-slate-100 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <CollapsibleTrigger className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                    <FolderOpen className="w-4 h-4 sm:w-5 sm:h-5 text-theme-action-primary flex-shrink-0" />
                    <div className="text-left flex-1 min-w-0">
                      <h4 className="text-slate-900 text-sm sm:text-base line-clamp-1">{folder.name}</h4>
                      <p className="text-[13px] sm:text-sm text-slate-600">
                        {folderPhotos.length} photo{folderPhotos.length !== 1 ? 's' : ''}
                        {mode === "select" && selectedPhotoIds.length > 0 && (
                          <span className="text-theme-action-primary ml-2">
                            • {folderPhotos.filter(p => selectedPhotoIds.includes(p.id)).length} selected
                          </span>
                        )}
                      </p>
                    </div>
                    <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400 transition-transform ui-open:rotate-180 flex-shrink-0" />
                  </CollapsibleTrigger>
                  
                  {/* Action Buttons - Below on Mobile, Same Line on Desktop */}
                  <div className="flex items-center gap-2">
                    {mode === "view" && onAudioTimelineClick && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-lg flex-1 sm:flex-none h-8 text-xs sm:text-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onAudioTimelineClick(folder.id);
                        }}
                      >
                        <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
                        <span className="hidden sm:inline">Audio Timeline</span>
                        <span className="sm:hidden">Audio</span>
                      </Button>
                    )}
                    {mode === "view" && onDeleteFolder && (
                      <div
                        className="rounded-lg h-8 w-8 hover:bg-red-50 border border-slate-300 hover:border-red-300 flex items-center justify-center transition-colors cursor-pointer flex-shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Delete "${folder.name}" and all its photos?`)) {
                            onDeleteFolder(folder.id);
                          }
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-600" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <CollapsibleContent>
                <div className="p-2 sm:p-4 bg-white">
                  <div className={`grid ${getGridCols()} gap-2`}>
                    {folderPhotos.map((photo) => (
                      <div
                        key={photo.id}
                        className={`group rounded-lg overflow-hidden border transition-all relative ${
                          mode === "select"
                            ? selectedPhotoIds.includes(photo.id)
                              ? "border-2 border-theme-action-primary bg-theme-focus-ring-light"
                              : "border-slate-200 hover:border-theme-hover-border cursor-pointer"
                            : "border-slate-200 hover:border-theme-hover-border"
                        }`}
                        onClick={() => {
                          if (mode === "select" && onTogglePhoto) {
                            onTogglePhoto(photo.id);
                          }
                        }}
                      >
                        {/* Photo Image */}
                        <div
                          onClick={() => mode === "view" && onPhotoClick?.(photo)}
                          className={`relative aspect-square ${mode === "view" ? "cursor-pointer" : ""}`}
                        >
                          <ImageWithFallback
                            src={photo.url}
                            alt={photo.name}
                            className="w-full h-full object-cover"
                          />
                          
                          {/* Select Mode - Checkbox */}
                          {mode === "select" && (
                            <div className="absolute top-1.5 right-1.5">
                              <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                                selectedPhotoIds.includes(photo.id)
                                  ? "bg-theme-action-primary"
                                  : "bg-white border-2 border-slate-300"
                              }`}>
                                {selectedPhotoIds.includes(photo.id) && (
                                  <Check className="w-3.5 h-3.5 text-white" />
                                )}
                              </div>
                            </div>
                          )}
                          
                          {/* View Mode - Hover overlay & Delete */}
                          {mode === "view" && (
                            <>
                              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <div className="text-white flex items-center gap-1">
                                  <Eye className="w-4 h-4" />
                                  <span className="text-xs">View</span>
                                </div>
                              </div>
                              {onDeletePhoto && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="absolute top-1.5 right-1.5 h-6 w-6 bg-red-600/90 hover:bg-red-700 opacity-0 group-hover:opacity-100 transition-opacity rounded-md"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (confirm(`Delete photo "${photo.name}"?`)) {
                                      onDeletePhoto(photo.id);
                                    }
                                  }}
                                >
                                  <Trash2 className="w-3 h-3 text-white" />
                                </Button>
                              )}
                            </>
                          )}
                          
                          {/* Description Checkmark - Bottom Right */}
                          {mode === "view" && photo.description && (
                            <div className="absolute bottom-1.5 right-1.5">
                              <div className="w-5 h-5 rounded-full bg-green-600 flex items-center justify-center">
                                <Check className="w-3.5 h-3.5 text-white" />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        );
      })}
    </div>
  );
}