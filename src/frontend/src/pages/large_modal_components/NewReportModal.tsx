import { useState, useEffect } from "react";
import { Button } from "../ui_components/button";
import { Input } from "../ui_components/input";
import { Label } from "../ui_components/label";
import { Textarea } from "../ui_components/textarea";
import { Badge } from "../ui_components/badge";
import { ScrollArea } from "../ui_components/scroll-area";
import { Checkbox } from "../ui_components/checkbox";
import { RadioGroup, RadioGroupItem } from "../ui_components/radio-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui_components/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui_components/select";
import { Separator } from "../ui_components/separator";
import { SecureImage } from "../smart_components/SecureImage";
import { PhotoFolderView } from "../smart_components/PhotoFolderView";
import { Photo, PhotoFolder, ReportTemplate } from "@/frontend/types";
import { 
  Camera, 
  ChevronRight, 
  ChevronLeft, 
  Sparkles, 
  Plus,
  X,
  GripVertical,
  Settings,
  Zap,
  FileText,
  Image,
  Check,
  ClipboardList,
  Building,
  HardHat,
  AlertTriangle,
  Briefcase,
  FlaskConical,
  TrendingUp
} from "lucide-react";



interface Section {
  id: number;
  title: string;
  photoIds: string[];
  isCustom?: boolean; // Flag to identify user-added sections
}

interface NewReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectName: string;
  onCreateReport: (reportData: any) => void;
  photos: Photo[];
  folders: PhotoFolder[];
}

// ============================================================================
// REPORT TEMPLATES - Fetched from Backend
// ============================================================================

export function NewReportModal({ open, onOpenChange, projectName, onCreateReport, photos, folders }: NewReportModalProps) {
  const [step, setStep] = useState(1);
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([]);
  const [reportMode, setReportMode] = useState<"auto" | "manual">("auto");
  const [sections, setSections] = useState<Section[]>([]);
  const [reportStyle, setReportStyle] = useState("comprehensive");
  const [reportWorkflow, setReportWorkflow] = useState("AUTHOR");
  const [processingMode, setProcessingMode] = useState<"TEXT_ONLY" | "IMAGE_AND_TEXT">("IMAGE_AND_TEXT");
  const [draggedPhoto, setDraggedPhoto] = useState<string | null>(null);

  // Fetch templates on mount
  useEffect(() => {
    async function fetchTemplates() {
      try {
        const response = await fetch("/api/report/templates");
        if (response.ok) {
          const data = await response.json();
          // Map string icons back to components if needed, or update Type
          const mappedTemplates = data.map((t: any) => ({
            ...t,
            icon: t.icon === "ClipboardList" ? ClipboardList : FileText // Simple mapper for now
          }));
          setTemplates(mappedTemplates);
        }
      } catch (error) {
        console.error("Failed to fetch templates:", error);
      }
    }
    fetchTemplates();
  }, []);

  // Get the selected template object
  const template = templates.find(t => t.id === selectedTemplate);

  // Helper: Convert template sections to Section objects with IDs
  const initializeSectionsFromTemplate = (templateId: string): Section[] => {
    const template = templates.find(t => t.id === templateId);
    if (!template) return [];
    
    return template.sections.map((section, index) => ({
      id: Date.now() + index,
      title: section.title,
      photoIds: [],
      isCustom: false // Standard sections are not custom
    }));
  };

  // Helper: Toggle photo selection
  const togglePhotoSelection = (photoId: string | number) => {
    const id = String(photoId);
    setSelectedPhotoIds(prev =>
      prev.includes(id)
        ? prev.filter(pId => pId !== id)
        : [...prev, id]
    );
  };

  // Helper: Add new section
  const addSection = () => {
    const newSection: Section = {
      id: Date.now(),
      title: "New Section",
      photoIds: [],
      isCustom: true // User added sections are custom
    };
    setSections([...sections, newSection]);
  };

  // Helper: Remove section
  const removeSection = (sectionId: number) => {
    setSections(sections.filter(s => s.id !== sectionId));
  };

  // Helper: Update section title
  const updateSectionTitle = (sectionId: number, title: string) => {
    setSections(sections.map(s =>
      s.id === sectionId ? { ...s, title, isCustom: true } : s // Renaming a standard section makes it custom
    ));
  };

  // Helper: Handle drag start
  const handleDragStart = (photoId: string | number) => {
    setDraggedPhoto(String(photoId));
  };

  // Helper: Handle drop at end of section
  const handleDrop = (sectionId: number) => {
    if (draggedPhoto === null) return;
    
    setSections(sections.map(section => {
      if (section.id === sectionId) {
        if (!section.photoIds.includes(draggedPhoto)) {
          return { ...section, photoIds: [...section.photoIds, draggedPhoto] };
        }
      }
      return section;
    }));
    
    setDraggedPhoto(null);
  };

  // Helper: Handle drop at specific position
  const handleDropAtPosition = (sectionId: number, targetIndex: number) => {
    if (draggedPhoto === null) return;
    
    setSections(sections.map(section => {
      if (section.id === sectionId) {
        // Remove the photo if it already exists in this section
        const filteredPhotoIds = section.photoIds.filter(id => id !== draggedPhoto);
        // Insert at the target position
        const newPhotoIds = [...filteredPhotoIds];
        newPhotoIds.splice(targetIndex, 0, draggedPhoto);
        return { ...section, photoIds: newPhotoIds };
      }
      return section;
    }));
    
    setDraggedPhoto(null);
  };

  // Helper: Remove photo from section
  const removePhotoFromSection = (sectionId: number, photoId: string) => {
    setSections(sections.map(section =>
      section.id === sectionId
        ? { ...section, photoIds: section.photoIds.filter(id => id !== photoId) }
        : section
    ));
  };

  // Helper: Duplicate photo in section
  const duplicatePhotoInSection = (sectionId: number, photoId: string) => {
    setSections(sections.map(section => {
      if (section.id === sectionId) {
        const index = section.photoIds.indexOf(photoId);
        if (index !== -1) {
          const newPhotoIds = [...section.photoIds];
          newPhotoIds.splice(index + 1, 0, photoId);
          return { ...section, photoIds: newPhotoIds };
        }
      }
      return section;
    }));
  };

  // Helper: Handle navigation to next step
  const handleNext = () => {
    if (step === 1 && selectedTemplate) {
      // Initialize sections from template when moving from step 1 to 2
      setSections(initializeSectionsFromTemplate(selectedTemplate));
    }
    
    if (step < 4) {
      setStep(step + 1);
    } else {
      handleSubmit();
    }
  };

  // Helper: Handle submit
  const handleSubmit = () => {
    const reportData = {
      templateId: selectedTemplate,
      title,
      photoIds: selectedPhotoIds,
      mode: reportMode,
      sections: reportMode === "manual" ? sections : undefined,
      style: reportStyle,
      reportWorkflow, // Replaces tone
      processingMode: processingMode,
      reportType: selectedTemplate ? selectedTemplate.toUpperCase() : "OBSERVATION" 
    };
    
    onCreateReport(reportData);
    
    // Reset all state
    setStep(1);
    setSelectedTemplate(null);
    setTitle("");
    setSelectedPhotoIds([]);
    setReportMode("auto");
    setSections([]);
    setReportStyle("comprehensive");
    setReportWorkflow("AUTHOR");
    setProcessingMode("IMAGE_AND_TEXT");
  };

  const selectedPhotos = photos.filter(p => selectedPhotoIds.includes(String(p.id)));

  // Helper: Check if current step is valid
  const isStepValid = () => {
    if (step === 1) return selectedTemplate !== null;
    if (step === 2) return title.trim() !== "" && selectedPhotoIds.length > 0;
    return true;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-20px)] sm:max-w-[1000px] h-[90vh] sm:h-[85vh] rounded-xl p-0 flex flex-col overflow-hidden">
        <DialogHeader className="px-3 sm:px-6 pt-3 sm:pt-6 pb-2 sm:pb-4 flex-shrink-0 border-b border-slate-200">
          <div className="flex items-center justify-between mb-1 sm:mb-2">
            <DialogTitle className="text-base sm:text-lg">Create New Report</DialogTitle>
            <div className="flex gap-1 sm:gap-2">
              {[1, 2, 3, 4].map(s => (
                <div
                  key={s}
                  className={`w-6 sm:w-8 h-0.5 sm:h-1 rounded-full ${
                    s <= step ? "bg-theme-action-primary" : "bg-slate-200"
                  }`}
                />
              ))}
            </div>
          </div>
          <DialogDescription className="text-xs sm:text-sm">
            {step === 1 && `Step 1 of 4: Choose a report template`}
            {step === 2 && `Step 2 of 4: Select photos and name your report`}
            {step === 3 && `Step 3 of 4: Organize your report structure`}
            {step === 4 && `Step 4 of 4: Configure report settings`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-6 py-2 sm:py-4">
          {/* Step 1: Template Selection */}
          {step === 1 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
              {templates.map((template) => {
                const Icon = template.icon;
                return (
                  <div
                    key={template.id}
                    className={`relative rounded-lg sm:rounded-xl border-2 p-3 sm:p-5 cursor-pointer transition-all ${
                      selectedTemplate === template.id
                        ? "border-theme-action-primary bg-theme-focus-ring-light shadow-md"
                        : "border-slate-200 hover:border-theme-hover-border hover:bg-slate-50"
                    }`}
                    onClick={() => setSelectedTemplate(template.id)}
                  >
                    {selectedTemplate === template.id && (
                      <div className="absolute top-2 sm:top-3 right-2 sm:right-3 w-5 h-5 sm:w-6 sm:h-6 bg-theme-action-primary rounded-full flex items-center justify-center">
                        <Check className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                      </div>
                    )}
                    
                    <div className="flex items-start gap-2 sm:gap-3 mb-2 sm:mb-3">
                      <div className={`w-9 h-9 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        selectedTemplate === template.id
                          ? "bg-theme-action-primary"
                          : "bg-slate-100"
                      }`}>
                        <Icon className={`w-5 h-5 sm:w-6 sm:h-6 ${
                          selectedTemplate === template.id
                            ? "text-white"
                            : "text-slate-600"
                        }`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-slate-900 mb-0.5 sm:mb-1 text-sm sm:text-base">{template.name}</h4>
                        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed line-clamp-2">
                          {template.description}
                        </p>
                      </div>
                    </div>
                    
                    <div className="mt-2 sm:mt-4 pt-2 sm:pt-4 border-t border-slate-200">
                      <p className="text-[10px] sm:text-xs text-slate-500 mb-1 sm:mb-2">Template sections:</p>
                      <div className="flex flex-wrap gap-0.5 sm:gap-1">
                        {template.sections.slice(0, 4).map((section, index) => (
                          <Badge key={index} variant="secondary" className="text-[10px] sm:text-xs rounded-md">
                            {section.title}
                          </Badge>
                        ))}
                        {template.sections.length > 4 && (
                          <Badge variant="secondary" className="text-[10px] sm:text-xs rounded-md">
                            +{template.sections.length - 4} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Step 2: Photo Selection */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="bg-theme-focus-ring-light border border-theme-hover-border rounded-lg p-3 flex items-start gap-3">
                {template && (
                  <>
                    <div className="w-8 h-8 bg-theme-action-primary rounded-lg flex items-center justify-center flex-shrink-0">
                      {(() => {
                        const Icon = template.icon;
                        return <Icon className="w-5 h-5 text-white" />;
                      })()}
                    </div>
                    <div>
                      <p className="text-sm text-slate-900">Using template: <span className="font-semibold">{template.name}</span></p>
                      <p className="text-xs text-slate-600">{template.sections.length} sections will be created</p>
                    </div>
                  </>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">Report Title *</Label>
                <Input
                  id="title"
                  placeholder="e.g., Foundation Assessment - Section A"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="rounded-lg"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Select Photos ({selectedPhotoIds.length} selected)</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => 
                      setSelectedPhotoIds(
                        selectedPhotoIds.length === photos.length 
                          ? [] 
                          : photos.map(p => String(p.id))
                      )
                    }
                    className="rounded-lg"
                  >
                    {selectedPhotoIds.length === photos.length ? "Deselect All" : "Select All"}
                  </Button>
                </div>
                <PhotoFolderView
                  folders={folders}
                  photos={photos}
                  mode="select"
                  selectedPhotoIds={selectedPhotoIds}
                  onTogglePhoto={togglePhotoSelection}
                />
              </div>
            </div>
          )}

          {/* Step 3: Report Structure */}
          {step === 3 && (
            <div className="space-y-3">
              {/* Mode Selection */}
              <RadioGroup value={reportMode} onValueChange={(v) => setReportMode(v as "auto" | "manual")}>
                <div className="grid grid-cols-2 gap-3">
                  <div
                    className={`relative rounded-xl border-2 p-3 cursor-pointer transition-all ${
                      reportMode === "auto"
                        ? "border-theme-action-primary bg-theme-focus-ring-light"
                        : "border-slate-200 hover:border-theme-hover-border"
                    }`}
                    onClick={() => setReportMode("auto")}
                  >
                    <RadioGroupItem value="auto" id="auto" className="absolute top-3 right-3" />
                    <div className="flex items-start gap-2">
                      <div className="w-8 h-8 bg-gradient-to-br from-theme-action-primary to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Sparkles className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1 pr-6">
                        <h4 className="text-sm text-slate-900 mb-0.5">AI Auto-Generate</h4>
                        <p className="text-xs text-slate-600">
                          AI organizes photos into sections
                        </p>
                      </div>
                    </div>
                  </div>

                  <div
                    className={`relative rounded-xl border-2 p-3 cursor-pointer transition-all ${
                      reportMode === "manual"
                        ? "border-theme-action-primary bg-theme-focus-ring-light"
                        : "border-slate-200 hover:border-theme-hover-border"
                    }`}
                    onClick={() => setReportMode("manual")}
                  >
                    <RadioGroupItem value="manual" id="manual" className="absolute top-3 right-3" />
                    <div className="flex items-start gap-2">
                      <div className="w-8 h-8 bg-slate-600 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Settings className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1 pr-6">
                        <h4 className="text-sm text-slate-900 mb-0.5">Manual Structure</h4>
                        <p className="text-xs text-slate-600">
                          Drag & organize yourself
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </RadioGroup>

              {/* Photo Library - Sticky at top */}
              {selectedPhotos.length > 0 && (
                <div className="border-2 border-theme-hover-border bg-theme-focus-ring-light rounded-lg p-3 sticky top-0 z-10">
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm text-slate-900">
                      📸 Photo Library ({selectedPhotos.length})
                    </Label>
                    {reportMode === "manual" && (
                      <Badge variant="default" className="rounded-md text-xs bg-theme-action-primary">
                        Drag to sections below
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedPhotos.map(photo => (
                      <div
                        key={photo.id}
                        draggable={reportMode === "manual"}
                        onDragStart={() => handleDragStart(photo.id)}
                        className={`relative w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${
                          reportMode === "manual"
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

              {/* Manual Mode - Sections */}
              {reportMode === "manual" && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm">Report Sections ({sections.length})</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addSection}
                      className="rounded-lg h-8"
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Add Section
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {sections.map((section) => (
                      <div key={section.id} className="border-2 border-slate-200 rounded-lg p-3 bg-white">
                        <div className="flex items-center gap-2 mb-2">
                          <GripVertical className="w-4 h-4 text-slate-400 flex-shrink-0" />
                          <Input
                            value={section.title}
                            onChange={(e) => updateSectionTitle(section.id, e.target.value)}
                            className="rounded-lg flex-1 h-8 text-sm"
                            placeholder="Section title"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeSection(section.id)}
                            className="rounded-lg h-8 w-8 flex-shrink-0"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>

                        <div
                          className="min-h-[70px] border-2 border-dashed border-slate-300 rounded-lg p-2 bg-slate-50/50"
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => handleDrop(section.id)}
                        >
                          {section.photoIds.length === 0 ? (
                            <div className="flex items-center justify-center h-[54px] text-xs text-slate-500">
                              <Camera className="w-3 h-3 mr-2" />
                              Drop photos here
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {section.photoIds.map((photoId, photoIndex) => {
                                const photo = photos.find(p => String(p.id) === photoId);
                                if (!photo) return null;
                                return (
                                  <div key={`${section.id}-${photoId}-${photoIndex}`} className="inline-flex items-center">
                                    {/* Drop zone before photo */}
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
                                    
                                    {/* Photo thumbnail */}
                                    <div className="relative w-16 h-16 rounded-lg overflow-hidden border-2 border-slate-200 group mx-1">
                                      <SecureImage
                                        src={photo.url}
                                        storagePath={photo.storagePath}
                                        alt={photo.name}
                                        className="w-full h-full object-cover"
                                      />
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
                                      <div className="absolute bottom-0.5 right-0.5 bg-theme-action-primary text-white text-xs px-1 rounded">
                                        {photoIndex + 1}
                                      </div>
                                    </div>
                                    
                                    {/* Drop zone after last photo */}
                                    {photoIndex === section.photoIds.length - 1 && (
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
                </div>
              )}

              {/* Auto Mode - Confirmation */}
              {reportMode === "auto" && (
                <div className="py-8 flex items-center justify-center">
                  <div className="text-center max-w-md">
                    <div className="w-16 h-16 bg-gradient-to-br from-theme-action-primary to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <Sparkles className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-slate-900 mb-2">AI Will Structure Your Report</h3>
                    <p className="text-sm text-slate-600 mb-4">
                      Our AI will analyze your {selectedPhotos.length} selected photos and automatically organize them into the {sections.length} template sections.
                    </p>
                    <div className="bg-theme-focus-ring-light border border-theme-hover-border rounded-lg p-3 text-left">
                      <p className="text-xs text-slate-600 mb-2">Sections to be created:</p>
                      <div className="flex flex-wrap gap-1">
                        {sections.map((section) => (
                          <Badge key={section.id} variant="secondary" className="text-xs rounded-md">
                            {section.title}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Generation Options */}
          {step === 4 && (
            <div className="space-y-6">
              <div className="space-y-3">
                <Label>Report Style</Label>
                <Select value={reportStyle} onValueChange={setReportStyle}>
                  <SelectTrigger className="rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-lg">
                    <SelectItem value="comprehensive" className="rounded-md">
                      <div>
                        <p>Comprehensive</p>
                        <p className="text-xs text-slate-500">Detailed analysis with full context</p>
                      </div>
                    </SelectItem>
                    <SelectItem value="concise" className="rounded-md">
                      <div>
                        <p>Concise</p>
                        <p className="text-xs text-slate-500">Key findings and observations only</p>
                      </div>
                    </SelectItem>
                    <SelectItem value="executive" className="rounded-md">
                      <div>
                        <p>Executive Summary</p>
                        <p className="text-xs text-slate-500">High-level overview for stakeholders</p>
                      </div>
                    </SelectItem>
                    <SelectItem value="technical" className="rounded-md">
                      <div>
                        <p>Technical Deep-Dive</p>
                        <p className="text-xs text-slate-500">In-depth technical specifications</p>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label>AI Processing Mode</Label>
                <Select value={processingMode} onValueChange={(val) => setProcessingMode(val as any)}>
                  <SelectTrigger className="rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-lg">
                    <SelectItem value="IMAGE_AND_TEXT" className="rounded-md">
                      <div>
                        <p>Image & Text Analysis</p>
                        <p className="text-xs text-slate-500">Analyze photos and generate detailed descriptions</p>
                      </div>
                    </SelectItem>
                    <SelectItem value="TEXT_ONLY" className="rounded-md">
                      <div>
                        <p>Text Only (Faster)</p>
                        <p className="text-xs text-slate-500">Skip deep image analysis, focus on structure</p>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label>Generation Strategy</Label>
                <Select value={reportWorkflow} onValueChange={setReportWorkflow}>
                  <SelectTrigger className="rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-lg">
                    <SelectItem value="AUTHOR" className="rounded-md">
                      <div>
                        <p>Sequential Author</p>
                        <p className="text-xs text-slate-500">Writes one section at a time (Higher Quality)</p>
                      </div>
                    </SelectItem>
                    <SelectItem value="DISPATCHER" className="rounded-md">
                      <div>
                        <p>Parallel Dispatcher</p>
                        <p className="text-xs text-slate-500">Generates all sections at once (Faster)</p>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div className="bg-slate-50 rounded-lg p-4 space-y-3">
                <h4 className="text-slate-900">Report Preview</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Template:</span>
                    <span className="text-slate-900">{template?.name || "Unknown"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Title:</span>
                    <span className="text-slate-900">{title || "Untitled Report"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Photos:</span>
                    <span className="text-slate-900">{selectedPhotoIds.length} selected</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Structure:</span>
                    <span className="text-slate-900">
                      {reportMode === "auto" ? "AI Auto-Generate" : `${sections.length} sections`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Style:</span>
                    <span className="text-slate-900 capitalize">{reportStyle}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Workflow:</span>
                    <span className="text-slate-900 capitalize">{reportWorkflow === "AUTHOR" ? "Sequential" : "Parallel"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Processing:</span>
                    <span className="text-slate-900">{processingMode === "IMAGE_AND_TEXT" ? "Image & Text" : "Text Only"}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t border-slate-200 flex-shrink-0 bg-white">
          <div className="flex justify-between w-full items-center">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (step > 1) {
                  setStep(step - 1);
                } else {
                  onOpenChange(false);
                }
              }}
              className="rounded-lg"
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              {step === 1 ? "Cancel" : "Back"}
            </Button>
            <div className="text-xs text-slate-500">
              Step {step} of 4
            </div>
            <Button
              onClick={handleNext}
              disabled={!isStepValid()}
              className="bg-theme-action-primary hover:bg-theme-hover-secondary rounded-lg"
            >
              {step === 4 ? (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Report
                </>
              ) : (
                <>
                  Next
                  <ChevronRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}