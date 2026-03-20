import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { SecureImage } from "@/components/ui/secure-image";
import { Photo } from "@/lib/types"; // Import shared Photo type
import {
  Calendar,
  MapPin,
  Save,
  Copy,
  Download,
  ChevronLeft,
  ChevronRight,
  Sparkles
} from "lucide-react";

interface PhotoDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  photo: Photo | null;
  onSaveDescription: (photoId: string | number, description: string) => void;
  onNavigate?: (direction: "prev" | "next") => void;
  canNavigate?: { prev: boolean; next: boolean };
}

export function PhotoDetailModal({
  open,
  onOpenChange,
  photo,
  onSaveDescription,
  onNavigate,
  canNavigate = { prev: false, next: false }
}: PhotoDetailModalProps) {
  const [description, setDescription] = useState(photo?.description || "");
  const [isEditing, setIsEditing] = useState(false);

  // Update description when photo changes
  const handlePhotoChange = (newPhoto: Photo | null) => {
    setDescription(newPhoto?.description || "");
    setIsEditing(false);
  };

  // Reset when modal opens/closes or photo changes
  if (photo && description !== photo.description && !isEditing) {
    setDescription(photo.description || "");
  }

  const handleSave = () => {
    if (photo) {
      onSaveDescription(photo.id as number, description);
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setDescription(photo?.description || "");
    setIsEditing(false);
  };

  const handleGenerateAI = () => {
    // Mock AI generation - in production this would call your AI service
    const aiDescription = `Foundation concrete pour, Section A-3. Surface appears smooth with consistent finish. No visible cracking or surface defects observed. Ambient temperature: 22°C, relative humidity: 65%. Pour completed at 14:30 local time.`;
    setDescription(aiDescription);
    setIsEditing(true);
  };

  if (!photo) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[1200px] w-[95vw] h-[90vh] rounded-xl p-0 flex flex-col overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 flex-shrink-0 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <DialogTitle>{photo.name}</DialogTitle>
            <DialogDescription className="sr-only">
              View and edit photo details and description
            </DialogDescription>
            <div className="flex items-center gap-2 mr-8">
              {/* Navigation arrows */}
              {onNavigate && (
                <div className="flex items-center gap-1 mr-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 rounded-lg"
                    onClick={() => onNavigate("prev")}
                    disabled={!canNavigate.prev}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 rounded-lg"
                    onClick={() => onNavigate("next")}
                    disabled={!canNavigate.next}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
              <Button variant="outline" size="sm" className="rounded-lg">
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-hidden flex">
          {/* Left side - Image */}
          <div className="flex-1 min-w-0 bg-slate-900 flex items-center justify-center p-6">
            <div className="max-w-full max-h-full">
              <SecureImage
                src={photo.url}
                storagePath={photo.storagePath}
                alt={photo.name}
                className="max-w-full max-h-full object-contain rounded-lg"
              />
            </div>
          </div>

          {/* Right side - Details and Descriptions (single scrollable column) */}
          <div className="w-[480px] min-w-[400px] bg-white border-l border-slate-200 flex flex-col overflow-hidden">
            {/* Single scrollable content area - Photo Details + AI Analysis + Description */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Photo metadata - compact inline row */}
              <div className="flex items-center gap-6 mb-6 pb-4 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-500">Date</p>
                    <p className="text-sm font-medium text-slate-900">{photo.date}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-500">Location</p>
                    <p className="text-sm font-medium text-slate-900">{photo.location}</p>
                  </div>
                </div>
              </div>

              {/* AI Analysis (read-only) */}
              {photo.ai_description && (
                <div className="mb-6">
                  <h3 className="text-slate-900 mb-2 flex items-center gap-2 font-medium">
                    <Sparkles className="w-4 h-4 text-theme-primary" />
                    AI Analysis
                  </h3>
                  <div className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                    {photo.ai_description}
                  </div>
                </div>
              )}

              {/* Description editor */}
              <div className="flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-slate-900">Description</h3>
                {!isEditing && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-lg"
                    onClick={() => setIsEditing(true)}
                  >
                    Edit
                  </Button>
                )}
                </div>

                {isEditing ? (
                <div className="flex flex-col gap-3">
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Add a detailed description of this photo..."
                    className="min-h-[120px] rounded-lg resize-y"
                  />

                  <div className="flex flex-col gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-lg hover:bg-blue-50 hover:border-blue-400"
                      onClick={handleGenerateAI}
                    >
                      <Sparkles className="w-4 h-4 mr-2 text-theme-primary" />
                      Generate with AI
                    </Button>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-lg flex-1"
                        onClick={handleCancel}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        className="rounded-lg flex-1 bg-blue-600 hover:bg-blue-700"
                        onClick={handleSave}
                      >
                        <Save className="w-4 h-4 mr-2" />
                        Save
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  {description ? (
                    <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                      {description}
                    </p>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-3">
                        <Sparkles className="w-6 h-6 text-slate-400" />
                      </div>
                      <p className="text-sm text-slate-500 mb-3">
                        No description added yet
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-lg"
                        onClick={() => setIsEditing(true)}
                      >
                        Add Description
                      </Button>
                    </div>
                  )}
                </div>
              )}
              </div>
            </div>

            {/* Quick actions - fixed at bottom */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex-shrink-0">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 rounded-lg"
                  onClick={() => {
                    navigator.clipboard.writeText(description);
                  }}
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copy
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 rounded-lg"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}