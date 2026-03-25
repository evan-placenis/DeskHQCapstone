"use client";

import { useCallback, useState } from "react";
import { Grid } from "react-window";
import { AutoSizer } from "react-virtualized-auto-sizer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SecureImage } from "@/components/ui/secure-image";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Calendar,
  Eye,
  Trash2,
  ChevronDown,
  FolderOpen,
  Check,
  Volume2,
  ImageDown,
  Loader2,
} from "lucide-react";
import { Photo, PhotoFolder } from "@/lib/types";
import { savePhotosToDeviceViaShare } from "@/features/projects/utils/save-photos-to-device";

const VIRTUALIZE_THRESHOLD = 24;//24;
const GAP = 8;

function getColumnCount(width: number, gridSize: number): number {
  const breakpoints = [
    [4, 6, 8, 10],  // gridSize 0: XS - most columns, smallest cells
    [3, 5, 6, 8],   // gridSize 1: S
    [3, 4, 5, 6],   // gridSize 2: M
    [2, 3, 4, 5],   // gridSize 3: L - fewest columns, largest cells
  ];
  const cols = breakpoints[Math.min(gridSize, 3)] ?? breakpoints[2];
  if (width >= 1024) return cols[3];
  if (width >= 768) return cols[2];
  if (width >= 640) return cols[1];
  return cols[0];
}

function PhotoCard({
  photo,
  mode,
  selectedPhotoIds,
  onTogglePhoto,
  onPhotoClick,
  onDeletePhoto,
}: {
  photo: Photo;
  mode: "view" | "select";
  selectedPhotoIds: (string | number)[];
  onTogglePhoto?: (id: string | number) => void;
  onPhotoClick?: (photo: Photo) => void;
  onDeletePhoto?: (id: string | number) => void;
}) {
  return (
    <div
      className={`group rounded-lg overflow-hidden border transition-all relative ${mode === "select"
        ? selectedPhotoIds.includes(photo.id)
          ? "border-2 border-theme-action-primary bg-theme-focus-ring-light"
          : "border-slate-200 hover:border-theme-hover-border cursor-pointer"
        : "border-slate-200 hover:border-theme-hover-border"
        }`}
      onClick={() => mode === "select" && onTogglePhoto?.(photo.id)}
    >
      <div
        onClick={() => mode === "view" && onPhotoClick?.(photo)}
        className={`relative aspect-square ${mode === "view" ? "cursor-pointer" : ""}`}
      >
        <SecureImage
          src={photo.url}
          storagePath={photo.storagePath}
          alt={photo.name}
          className="w-full h-full object-cover"
        />
        {mode === "select" && (
          <div className="absolute top-1.5 right-1.5">
            <div className={`w-5 h-5 rounded-full flex items-center justify-center ${selectedPhotoIds.includes(photo.id) ? "bg-theme-action-primary" : "bg-white border-2 border-slate-300"
              }`}>
              {selectedPhotoIds.includes(photo.id) && <Check className="w-3.5 h-3.5 text-white" />}
            </div>
          </div>
        )}
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
                className="absolute top-1.5 right-1.5 h-6 w-6 bg-slate-500 hover:!bg-red-600/90 opacity-0 group-hover:opacity-100 transition-opacity rounded-md"
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`Delete photo "${photo.name}"?`)) onDeletePhoto(photo.id);
                }}
              >
                <Trash2 className="w-3 h-3 text-white" />
              </Button>
            )}
          </>
        )}
        {mode === "view" && photo.description && (
          <div className="absolute bottom-1.5 right-1.5">
            <div className="w-5 h-5 rounded-full bg-green-600 flex items-center justify-center">
              <Check className="w-3.5 h-3.5 text-white" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function VirtualizedPhotoGrid({
  photos,
  width,
  height,
  gridSize,
  mode,
  selectedPhotoIds,
  onTogglePhoto,
  onPhotoClick,
  onDeletePhoto,
}: {
  photos: Photo[];
  width: number;
  height: number;
  gridSize: number;
  mode: "view" | "select";
  selectedPhotoIds: (string | number)[];
  onTogglePhoto?: (id: string | number) => void;
  onPhotoClick?: (photo: Photo) => void;
  onDeletePhoto?: (id: string | number) => void;
}) {
  const colCount = getColumnCount(width, gridSize);
  const rowCount = Math.ceil(photos.length / colCount) || 1;
  const cellSize = Math.floor((width - colCount * GAP) / colCount);
  const slotSize = cellSize + GAP;

  const CellComponent = useCallback(
    ({
      columnIndex,
      rowIndex,
      style,
      photos: cellPhotos,
      colCount: cols,
      mode: cellMode,
      selectedPhotoIds: cellSelectedIds,
      onTogglePhoto: cellOnToggle,
      onPhotoClick: cellOnClick,
      onDeletePhoto: cellOnDelete,
    }: {
      columnIndex: number;
      rowIndex: number;
      style: React.CSSProperties;
      photos: Photo[];
      colCount: number;
      mode: "view" | "select";
      selectedPhotoIds: (string | number)[];
      onTogglePhoto?: (id: string | number) => void;
      onPhotoClick?: (photo: Photo) => void;
      onDeletePhoto?: (id: string | number) => void;
    }) => {
      const index = rowIndex * cols + columnIndex;
      const photo = cellPhotos[index];
      if (!photo) return null;
      return (
        <div style={style} className="p-[4px]">
          <div className="w-full h-full min-h-0">
            <PhotoCard
              photo={photo}
              mode={cellMode}
              selectedPhotoIds={cellSelectedIds}
              onTogglePhoto={cellOnToggle}
              onPhotoClick={cellOnClick}
              onDeletePhoto={cellOnDelete}
            />
          </div>
        </div>
      );
    },
    []
  );

  const cellProps = {
    photos,
    colCount,
    mode,
    selectedPhotoIds,
    onTogglePhoto,
    onPhotoClick,
    onDeletePhoto,
  };

  return (
    <Grid
      cellComponent={CellComponent}
      cellProps={cellProps as never}
      columnCount={colCount}
      columnWidth={slotSize}
      rowCount={rowCount}
      rowHeight={slotSize}
      style={{ width, height, overflowX: "hidden", overflowY: "auto" }}
    />
  );
}

interface PhotoFolderViewProps {
  folders: PhotoFolder[];
  photos: Photo[];
  mode: "view" | "select";

  // For view mode
  onPhotoClick?: (photo: Photo) => void;
  onDeletePhoto?: (photoId: string | number) => void;
  onDeleteFolder?: (folderId: number) => void;
  onAudioTimelineClick?: (folderId: number) => void;

  // For select mode
  selectedPhotoIds?: (string | number)[];
  onTogglePhoto?: (photoId: string | number) => void;

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
  const [savingFolderId, setSavingFolderId] = useState<number | null>(null);

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
                  <div className="flex flex-wrap items-center gap-2 justify-end sm:justify-start">
                    {mode === "view" && folderPhotos.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-lg flex-1 sm:flex-none h-8 text-xs sm:text-sm"
                        disabled={savingFolderId === folder.id}
                        title="Save all photos in this folder to your device (Photos / Camera Roll)"
                        onClick={async (e) => {
                          e.stopPropagation();
                          setSavingFolderId(folder.id);
                          try {
                            await savePhotosToDeviceViaShare(folderPhotos);
                          } catch (err) {
                            if (err instanceof DOMException && err.name === "AbortError") {
                              return;
                            }
                            console.error("Save all photos failed:", err);
                            alert(
                              err instanceof Error
                                ? err.message
                                : "Could not save photos. Try again or save images one at a time."
                            );
                          } finally {
                            setSavingFolderId(null);
                          }
                        }}
                      >
                        {savingFolderId === folder.id ? (
                          <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2 animate-spin shrink-0" />
                        ) : (
                          <ImageDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2 shrink-0" />
                        )}
                        <span className="hidden sm:inline">Save all to camera roll</span>
                        <span className="sm:hidden">Save all</span>
                      </Button>
                    )}
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
                  {folderPhotos.length > VIRTUALIZE_THRESHOLD ? (
                    <div
                      className="w-full min-w-0 overflow-hidden min-h-[400px] max-h-[60vh]"
                    >
                      <AutoSizer
                        renderProp={({ width = 0, height = 0 }) => {
                          return (
                            <VirtualizedPhotoGrid
                              photos={folderPhotos}
                              width={width}
                              height={height}
                              gridSize={gridSize}
                              mode={mode}
                              selectedPhotoIds={selectedPhotoIds}
                              onTogglePhoto={onTogglePhoto}
                              onPhotoClick={onPhotoClick}
                              onDeletePhoto={onDeletePhoto}
                            />
                          );
                        }}
                      />
                    </div>
                  ) : (
                    <div className={`grid ${getGridCols()} gap-2`}>
                      {folderPhotos.map((photo) => (
                        <PhotoCard
                          key={photo.id}
                          photo={photo}
                          mode={mode}
                          selectedPhotoIds={selectedPhotoIds}
                          onTogglePhoto={onTogglePhoto}
                          onPhotoClick={onPhotoClick}
                          onDeletePhoto={onDeletePhoto}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        );
      })}
    </div>
  );
}