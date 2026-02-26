import { useState } from "react";
import { Button } from "../ui_components/button";
import { Input } from "../ui_components/input";
import { Label } from "../ui_components/label";
import { Badge } from "../ui_components/badge";
import { Textarea } from "../ui_components/textarea";
import { SecureImage } from "./SecureImage";
import { Photo } from "@/frontend/types";
import { ReportSection } from "@/app/shared/types/report-schemas";
import { EditorSection } from "@/frontend/types";
import {
  Camera,
  Plus,
  X,
  GripVertical,
  CornerDownRight,
} from "lucide-react";

// =========================================================
// INGESTION (Backend -> Frontend)
// =========================================================
/** Strip leading markdown (e.g. # or ##) from a title string so it displays as plain text. */
export function stripMarkdownFromTitle(s: string | undefined): string {
  if (s == null || typeof s !== 'string') return '';
  return s.replace(/^#+\s*/, '').trim() || s;
}

// Helper to convert ReportSection to editor format (flatten photoIds)
// Supports both: Architect's assignedImageIds (array of IDs) and legacy photoContext (array of { photoId, note })
export const convertSectionToEditorFormat = (section: any, index: number): any[] => {
  // Prefer assignedImageIds (new architect format), fallback to photoContext tuple format
  const extractIds = (s: any): string[] => {
    if (s.assignedImageIds && Array.isArray(s.assignedImageIds)) return s.assignedImageIds;
    return (s.photoContext || []).map((p: any) => p.photoId);
  };
  // Unpack the Architect's "photoContext" into a "Notes Map" (only when using legacy tuple format)
  const notesBackpack: Record<string, string> = {};
  if (section.photoContext && Array.isArray(section.photoContext)) {
    section.photoContext.forEach((item: any) => {
      if (item.photoId && item.note) notesBackpack[item.photoId] = item.note;
    });
  }

  // 1. Create the Parent Section (The "Container")
  const parentSection = {
    id: section.sectionId || `section-${index}`,
    title: stripMarkdownFromTitle(section.title),
    purpose: section.purpose,
    reportOrder: section.reportOrder || index + 1,
    photoIds: extractIds(section),
    originalNotesMap: notesBackpack,
    isSubsection: false,
    subsections: [],
  };

  // 2. Create the Children (Subsections)
  const childSections = (section.subsections || []).map((sub: any, subIndex: number) => {
    const subNotesBackpack: Record<string, string> = {};
    if (sub.photoContext && Array.isArray(sub.photoContext)) {
      sub.photoContext.forEach((item: any) => {
        if (item.photoId && item.note) subNotesBackpack[item.photoId] = item.note;
      });
    }
    return {
      id: sub.subSectionId || `section-${index}-sub-${subIndex}`,
      title: stripMarkdownFromTitle(sub.title),
      purpose: sub.purpose,
      reportOrder: (section.reportOrder || index + 1) + (subIndex + 1) * 0.1,
      photoIds: extractIds(sub),
      originalNotesMap: subNotesBackpack,
      isSubsection: true,
      parentId: parentSection.id,
    };
  });

  // 3. Return BOTH (Parent first, then Children)
  return [parentSection, ...childSections];
};

// =========================================================
// 2. EXPORT (Frontend -> Backend)
// =========================================================
// Helper to convert editor format back to ReportSection
export function convertEditorFormatToSection(editorSection: EditorSection): ReportSection {

    // 1. Reconstruct the "photoContext" Tuple Array
    // We look inside the "Backpack" (originalNotesMap) to find the note for each photo.
    const reconstructedContext = (editorSection.photoIds || []).map((photoId: string) => ({
      photoId: photoId,
      // Retrieve the note from the "Backpack" if we have it, otherwise empty string
      note: editorSection.originalNotesMap?.[photoId] || "" 
    }));
    return {
        sectionId: editorSection.id,
        title: editorSection.title,
        photoContext: reconstructedContext,
        reportOrder: editorSection.reportOrder || 1,
        purpose: editorSection.purpose,
        subsections: [], // Flatten everything on save (safer for generation)
      };
}



interface ReportStructureEditorProps {
  sections: EditorSection[];
  onSectionsChange: (sections: EditorSection[]) => void;
  photos: Photo[];
  selectedPhotoIds: string[];
  showPhotoLibrary?: boolean;
  readOnly?: boolean;
  additionalInstructions?: string;
  onAdditionalInstructionsChange?: (instructions: string) => void;
  showAdditionalInstructions?: boolean;
}

/**
 * Reusable Report Structure Editor Component
 * 
 * Features:
 * - Drag-and-drop photos from library to sections
 * - Add/remove sections
 * - Rename sections
 * - Reorder photos within sections
 * - Position-specific drops (insert before/after)
 */
export function ReportStructureEditor({
  sections,
  onSectionsChange,
  photos,
  selectedPhotoIds,
  showPhotoLibrary = true,
  readOnly = false,
  additionalInstructions = "",
  onAdditionalInstructionsChange,
  showAdditionalInstructions = false,
}: ReportStructureEditorProps) {
  const [draggedPhoto, setDraggedPhoto] = useState<string | null>(null);
  const [draggedSection, setDraggedSection] = useState<string | null>(null);

  // Get selected photos
  const selectedPhotos = photos.filter(p => selectedPhotoIds.includes(String(p.id)));

  // ============================================================================
  // Section Management
  // ============================================================================

// Adds a TOP-LEVEL section to the bottom of the list
  const addSection = () => {
    const newSection: EditorSection = {
      id: `section-${Date.now()}`,
      title: "New Main Section",
      photoIds: [],
      isSubsection: false, // <--- Fixes TS Error
    };
    onSectionsChange([...sections, newSection]);
  };

  // Adds a SUB-SECTION immediately after the specific parent
const addSubsection = (parentId: string) => {
    const parentIndex = sections.findIndex(s => s.id === parentId);
    if (parentIndex === -1) return;
  
    const newSubsection: EditorSection = {
      id: `sub-${Date.now()}`,
      title: "New Subsection", 
      photoIds: [],
      isSubsection: true, // <--- Mark as child
    };
  
    // Create new array and splice the child in right after the parent
    const newSections = [...sections];
    newSections.splice(parentIndex + 1, 0, newSubsection);
    
    onSectionsChange(newSections);
  };

  const removeSection = (sectionId: string) => {
    onSectionsChange(sections.filter(s => s.id !== sectionId));
  };

  const updateSectionTitle = (sectionId: string, title: string) => {
    onSectionsChange(
      sections.map(s =>
        s.id === sectionId ? { ...s, title } : s
      )
    );
  };

  // ============================================================================
  // Drag & Drop Handlers
  // ============================================================================

  const handleDragStart = (photoId: string) => {
    setDraggedPhoto(photoId);
  };

  const handleSectionDragStart = (e: React.DragEvent, sectionId: string) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', sectionId);
    setDraggedSection(sectionId);
  };

  const handleSectionDragEnd = () => {
    setDraggedSection(null);
  };

  const handleSectionDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleSectionDrop = (e: React.DragEvent, targetSectionId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!draggedSection || draggedSection === targetSectionId) {
      setDraggedSection(null);
      return;
    }

    const draggedIndex = sections.findIndex(s => s.id === draggedSection);
    const targetIndex = sections.findIndex(s => s.id === targetSectionId);

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedSection(null);
      return;
    }

    const newSections = [...sections];
    const [removed] = newSections.splice(draggedIndex, 1);
    newSections.splice(targetIndex, 0, removed);

    onSectionsChange(newSections);
    setDraggedSection(null);
  };

  const handleDrop = (sectionId: string) => {
    if (!draggedPhoto) return;
    
    onSectionsChange(
      sections.map(section => {
        if (section.id === sectionId) {
          if (!section.photoIds.includes(draggedPhoto)) {
            return { ...section, photoIds: [...section.photoIds, draggedPhoto] };
          }
        }
        return section;
      })
    );
    
    setDraggedPhoto(null);
  };

  const handleDropAtPosition = (sectionId: string, targetIndex: number) => {
    if (!draggedPhoto) return;
    
    onSectionsChange(
      sections.map(section => {
        if (section.id === sectionId) {
          // Remove the photo if it already exists in this section
          const filteredPhotoIds = section.photoIds.filter(id => id !== draggedPhoto);
          // Insert at the target position
          const newPhotoIds = [...filteredPhotoIds];
          newPhotoIds.splice(targetIndex, 0, draggedPhoto);
          return { ...section, photoIds: newPhotoIds };
        }
        return section;
      })
    );
    
    setDraggedPhoto(null);
  };

  const removePhotoFromSection = (sectionId: string, photoId: string) => {
    onSectionsChange(
      sections.map(section =>
        section.id === sectionId
          ? { ...section, photoIds: section.photoIds.filter(id => id !== photoId) }
          : section
      )
    );
  };

  const duplicatePhotoInSection = (sectionId: string, photoId: string) => {
    onSectionsChange(
      sections.map(section => {
        if (section.id === sectionId) {
          const index = section.photoIds.indexOf(photoId);
          if (index !== -1) {
            const newPhotoIds = [...section.photoIds];
            newPhotoIds.splice(index + 1, 0, photoId);
            return { ...section, photoIds: newPhotoIds };
          }
        }
        return section;
      })
    );
  };

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="space-y-3">
      {/* Photo Library - Sticky at top with opaque background */}
      {showPhotoLibrary && selectedPhotos.length > 0 && (
        <div className="border-2 border-theme-hover-border bg-white rounded-lg p-3 sticky top-0 z-10 shadow-md">
          <div className="flex items-center justify-between mb-2">
            <Label className="text-sm text-slate-900">
              📸 Photo Library ({selectedPhotos.length})
            </Label>
            {!readOnly && (
              <Badge variant="default" className="rounded-md text-xs bg-theme-action-primary">
                Drag sections below to reorder
              </Badge>
            )}

            {!readOnly && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addSection}
              className="rounded-lg h-7"
            >
              <Plus className="w-3 h-3 mr-1" />
              Add Section
            </Button>
          )}
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedPhotos.map(photo => (
              <div
                key={photo.id}
                draggable={!readOnly}
                onDragStart={() => handleDragStart(String(photo.id))}
                className={`relative w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${
                  !readOnly
                    ? "border-theme-action-primary cursor-move hover:border-theme-hover-secondary hover:scale-110 hover:shadow-lg"
                    : "border-theme-hover-border"
                }`}
                title={photo.name}
              >
                <SecureImage
                  src={photo.url}
                  storagePath={photo.storagePath}
                  alt={photo.name}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sections */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label className="text-sm">Report Sections ({sections.length})</Label>
          
        </div>

        <div 
          className="space-y-3"
          onDragOver={(e) => {
            if (draggedSection) {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
            }
          }}
        >
          {sections.map((section) => (
            <div 
              // 🎨 VISUAL LOGIC:
            // If it is a subsection:
            // 1. Add left margin (ml-8)
            // 2. Add a different border color or background to distinguish it
            // 3. Scale it down slightly (w-[calc(100%-2rem)])
            key={section.id}
            className={`
                relative transition-all border-2 rounded-lg p-3 
                ${!readOnly ? 'cursor-move' : ''}
                ${draggedSection === section.id ? 'opacity-50 scale-95' : 'border-slate-200'}
                ${section.isSubsection ? 'ml-12 bg-slate-50 border-l-4 border-l-slate-300' : 'bg-white'}
            `}
            draggable={!readOnly}
            onDragStart={(e) => handleSectionDragStart(e, section.id)}
            onDragEnd={handleSectionDragEnd}
            onDragOver={handleSectionDragOver}
            onDrop={(e) => handleSectionDrop(e, section.id)}
            >
            {/* Visual Connector Line (Optional Polish) */}
            {section.isSubsection && (
                <div className="absolute -left-6 top-1/2 w-4 h-[2px] bg-slate-300" />
            )}
        
            <div className="relative flex items-center">
                <GripVertical 
                className={`w-4 h-4 flex-shrink-0 ${!readOnly ? 'text-slate-400 cursor-grab active:cursor-grabbing' : 'text-slate-200'}`}
                />
                
                {/* 🎨 ICON: Show CornerDownRight for subsections */}
                {section.isSubsection && (
                <CornerDownRight className="w-4 h-4 text-slate-400" />
                )}
        
                <Input
                value={section.title}
                onChange={(e) => updateSectionTitle(section.id, e.target.value)}
                // Make subsection titles slightly smaller
                className={`rounded-lg flex-1 h-8 ${section.isSubsection ? 'text-xs font-medium' : 'text-sm font-bold'}`}
                placeholder="Section title"
                readOnly={readOnly}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
    
                {/* 🆕 ADD SUBSECTION BUTTON */}
                {/* Only show this on Main Sections (isSubsection === false) */}
                {!section.isSubsection && !readOnly && (
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => addSubsection(section.id)}
                    className="rounded-lg h-8 w-8 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                    title="Add Subsection under this section"
                >
                    <div className="flex items-center justify-center">
                    {/* Visual cue: A small plus with a down-right arrow */}
                    <CornerDownRight className="w-4 h-4 text-gray-500 hover:text-blue-500" />
                    </div>
                </Button>
                )}

                {/* Remove Button */}
                {!readOnly && (
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeSection(section.id)}
                    className="rounded-lg h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50"
                >
                    <X className="w-4 h-4" />
                </Button>
                )}
            </div>
                
              </div>

              <div
                className={`min-h-[70px] border-2 border-dashed border-slate-300 rounded-lg p-2 bg-slate-50/50 ${
                  !readOnly ? 'cursor-pointer' : ''
                }`}
                onDragOver={(e) => !readOnly && e.preventDefault()}
                onDrop={() => !readOnly && handleDrop(section.id)}
              >
                {section.photoIds.length === 0 ? (
                  <div className="flex items-center justify-center h-[54px] text-xs text-slate-500">
                    <Camera className="w-3 h-3 mr-2" />
                    {readOnly ? 'No photos assigned' : 'Drop photos here'}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {section.photoIds.map((photoId, photoIndex) => {
                      const photo = photos.find(p => String(p.id) === photoId);
                      if (!photo) return null;
                      return (
                        <div key={`${section.id}-${photoId}-${photoIndex}`} className="inline-flex items-center">
                          {/* Drop zone before photo */}
                          {!readOnly && (
                            <div
                              className="w-6 h-16 rounded bg-slate-200 hover:bg-theme-action-primary hover:w-8 transition-all cursor-pointer flex-shrink-0"
                              onDragOver={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                              }}
                              onDrop={(e) => {
                                e.stopPropagation();
                                handleDropAtPosition(section.id, photoIndex);
                              }}
                              title="Drop here to insert before"
                            />
                          )}
                          
                          {/* Photo thumbnail */}
                          <div className={`relative w-16 h-16 rounded-lg overflow-hidden border-2 border-slate-200 group ${!readOnly ? 'mx-1' : 'mr-1'}`}>
                            <SecureImage
                              src={photo.url}
                              storagePath={photo.storagePath}
                              alt={photo.name}
                              className="w-full h-full object-cover"
                            />
                            {!readOnly && (
                              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="w-5 h-5 text-white hover:bg-white/20 rounded"
                                  onClick={() => removePhotoFromSection(section.id, photoId)}
                                  title="Remove"
                                >
                                  <X className="w-3 h-3" />
                                </Button>
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="w-5 h-5 text-white hover:bg-white/20 rounded"
                                  onClick={() => duplicatePhotoInSection(section.id, photoId)}
                                  title="Duplicate"
                                >
                                  <Plus className="w-3 h-3" />
                                </Button>
                              </div>
                            )}
                            <div className="absolute bottom-0.5 right-0.5 bg-theme-action-primary text-white text-xs px-1 rounded">
                              {photoIndex + 1}
                            </div>
                          </div>
                          
                          {/* Drop zone after last photo */}
                          {!readOnly && photoIndex === section.photoIds.length - 1 && (
                            <div
                              className="w-2 h-16 rounded bg-slate-200 hover:bg-theme-action-primary transition-colors cursor-pointer flex-shrink-0"
                              onDragOver={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                              }}
                              onDrop={(e) => {
                                e.stopPropagation();
                                handleDropAtPosition(section.id, photoIndex + 1);
                              }}
                              title="Drop here to insert after"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Additional Instructions */}
        {showAdditionalInstructions && (
          <div className="mt-4 space-y-2">
            <Label className="text-sm">Additional Instructions (Optional)</Label>
            <Textarea
              value={additionalInstructions}
              onChange={(e) => onAdditionalInstructionsChange?.(e.target.value)}
              placeholder="Add any special instructions for the AI (e.g., 'Focus on safety concerns', 'Use formal tone', 'Include cost estimates')"
              className="rounded-lg resize-none"
              rows={3}
              disabled={readOnly}
            />
            <p className="text-xs text-slate-500">
              These instructions will guide the AI when generating content for this report.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
