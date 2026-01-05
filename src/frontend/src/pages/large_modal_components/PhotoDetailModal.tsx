import { useState } from "react";
import { Button } from "../ui_components/button";
import { Textarea } from "../ui_components/textarea";
import { Badge } from "../ui_components/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui_components/dialog";
import { ImageWithFallback } from "../figma/ImageWithFallback";
import { Photo } from "@/frontend/types"; // Import shared Photo type
import { 
  X, 
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
      <DialogContent className="sm:max-w-[900px] h-[85vh] rounded-xl p-0 flex flex-col overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 flex-shrink-0 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <DialogTitle>{photo.name}</DialogTitle>
            <DialogDescription className="sr-only">
              View and edit photo details and description
            </DialogDescription>
            <div className="flex items-center gap-2">
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
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 rounded-lg"
                onClick={() => onOpenChange(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-hidden flex">
          {/* Left side - Image */}
          <div className="flex-1 bg-slate-900 flex items-center justify-center p-6">
            <div className="max-w-full max-h-full">
              <ImageWithFallback
                src={photo.url}
                alt={photo.name}
                className="max-w-full max-h-full object-contain rounded-lg"
              />
            </div>
          </div>

          {/* Right side - Details and Description */}
          <div className="w-[400px] bg-white border-l border-slate-200 flex flex-col">
            {/* Photo metadata */}
            <div className="p-6 border-b border-slate-200 flex-shrink-0">
              <h3 className="text-slate-900 mb-4">Photo Details</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Calendar className="w-4 h-4 text-slate-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-slate-500">Date Captured</p>
                    <p className="text-sm text-slate-900">{photo.date}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-slate-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-slate-500">Location</p>
                    <p className="text-sm text-slate-900">{photo.location}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Description editor */}
            <div className="flex-1 flex flex-col p-6 overflow-hidden">
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
                <div className="flex-1 flex flex-col gap-3">
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Add a detailed description of this photo..."
                    className="flex-1 rounded-lg resize-none"
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
                <div className="flex-1 overflow-y-auto">
                  {description ? (
                    <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                      {description}
                    </p>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center">
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

            {/* Quick actions */}
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