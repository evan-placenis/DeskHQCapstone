import { useState } from "react";
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
import { PhotoFolderView } from "../smart_components/PhotoFolderView";
import { Photo, PhotoFolder, ReportTemplate } from "@/frontend/types";
import { REPORT_TEMPLATES } from "@/frontend/types/report_template_types";
import { EditorSection } from "@/frontend/types";
import {
  ChevronRight,
  ChevronLeft,
  Sparkles,
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
  TrendingUp,
} from "lucide-react";


import { ReportStructureEditor } from '../smart_components/ReportStructureEditor';


interface NewReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectName: string;
  onCreateReport: (reportData: any) => void;
  photos: Photo[];
  folders: PhotoFolder[];
}

// ============================================================================
// REPORT TEMPLATES - From frontend types (report_template_types.ts)
// ============================================================================

export function NewReportModal({ open, onOpenChange, projectName, onCreateReport, photos, folders }: NewReportModalProps) {
  const [step, setStep] = useState(1);
  const [templates] = useState<ReportTemplate[]>(REPORT_TEMPLATES);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([]);
  const [reportMode, setReportMode] = useState<"auto" | "manual">("auto");
  const [sections, setSections] = useState<EditorSection[]>([]);
  const [reportExecution, setReportExecution] = useState<"fast" | "thinking">("fast");
  const [processingMode, setProcessingMode] = useState<"TEXT_ONLY" | "IMAGE_AND_TEXT">("IMAGE_AND_TEXT");
  const [modelProvider, setModelProvider] = useState<'grok' | 'claude' | 'gemini-pro' | 'gemini-cheap'>('gemini-cheap');
  const [workflowType, setWorkflowType] = useState<string>("simple");
  const [additionalInstructions, setAdditionalInstructions] = useState("");

  // Get the selected template object
  const template = templates.find(t => t.id === selectedTemplate);

  const initializeSectionsFromTemplate = (templateId: string): EditorSection[] => {
    const template = templates.find(t => t.id === templateId);
    if (!template) return [];
    
    // 🛠️ FLATTEN LOGIC: Convert hierarchical template -> flat editor list
    return template.sections.flatMap((section, index) => {
      
      // 1. Create Parent Section
      // Check if the template implies this is just a container (has subsections) or a real section
      const mainSection: EditorSection = {
        id: `section-${Date.now()}-${index}`,
        title: section.title,
        photoIds: [],
        reportOrder: index + 1,
        isSubsection: false, // It's a parent
        // If your template type has 'purpose', add it here
        // purpose: section.purpose 
      };

      // 2. Create Child Sections (if any)
      // We check if 'subsections' exists on the template section
      // You might need to cast 'section' as 'any' if TypeScript complains about subsections 
      // not being on the default ReportTemplate type yet, OR update your ReportTemplate type.
      const subSections: EditorSection[] = (section as any).subsections?.map((sub: any, subIndex: number) => ({
        id: `section-${Date.now()}-${index}-sub-${subIndex}`,
        title: sub.title,
        photoIds: [],
        // Order: 3.1, 3.2, etc. (Just for sorting)
        reportOrder: (index + 1) + ((subIndex + 1) * 0.01),
        isSubsection: true, // It's a child
        purpose: sub.purpose
      })) || [];

      // 3. Return combined array
      return [mainSection, ...subSections];
    });
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
      style: reportExecution,
      isThinkingMode: reportExecution === "thinking",
      processingMode: processingMode,
      modelName: modelProvider,
      workflowType: workflowType,
      reportType: selectedTemplate ? selectedTemplate.toUpperCase() : "OBSERVATION",
      additionalInstructions: additionalInstructions || undefined
    };
    
    onCreateReport(reportData);
    
    // Reset all state
    setStep(1);
    setSelectedTemplate(null);
    setTitle("");
    setSelectedPhotoIds([]);
    setReportMode("auto");
    setSections([]);
    setReportExecution("fast");
    setProcessingMode("IMAGE_AND_TEXT");
    setModelProvider("gemini-cheap");
    setWorkflowType("simple");
    setAdditionalInstructions("");
    onOpenChange(false);
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

              {/* Manual Mode - Use ReportStructureEditor */}
              {reportMode === "manual" && (
                <ReportStructureEditor
                  sections={sections}
                  onSectionsChange={setSections}
                  photos={photos}
                  selectedPhotoIds={selectedPhotoIds}
                  showPhotoLibrary={true}
                  readOnly={false}
                  additionalInstructions={additionalInstructions}
                  onAdditionalInstructionsChange={setAdditionalInstructions}
                  showAdditionalInstructions={true}
                />
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
                <Label>AI Model</Label>
                <Select value={modelProvider} onValueChange={(v) => setModelProvider(v as 'grok' | 'gemini-pro' | 'gemini-cheap' | 'claude')}>
                  <SelectTrigger className="rounded-lg">
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent className="rounded-lg">
                    <SelectItem value="grok" className="rounded-md">
                      <div>
                        <p>Grok (xAI)</p>
                        <p className="text-xs text-slate-500">grok-4-fast — fast and capable</p>
                      </div>
                    </SelectItem>
                    <SelectItem value="gemini-pro" className="rounded-md">
                      <div>
                        <p>Gemini-Pro(Google)</p>
                        <p className="text-xs text-slate-500">gemini-3-pro — strong reasoning</p>
                      </div>
                    </SelectItem>
                    <SelectItem value="claude" className="rounded-md">
                      <div>
                        <p>Claude (Anthropic)</p>
                        <p className="text-xs text-slate-500">claude-4.5-sonnet — strong agentic capabilities</p>
                      </div>
                    </SelectItem>
                    <SelectItem value="gemini-cheap" className="rounded-md">
                      <div>
                        <p>Gemini-Cheap(Google)</p>
                        <p className="text-xs text-slate-500">gemini-3-flash — fast and cheap</p>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label>Report Execution</Label>
                <Select
                  value={reportExecution}
                  onValueChange={(v) => setReportExecution(v as "fast" | "thinking")}
                >
                  <SelectTrigger className="rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-lg">
                    <SelectItem value="fast" className="rounded-md">
                      <div>
                        <p>Fast</p>
                        <p className="text-xs text-slate-500">
                          Quick execution with minimal additional reasoning
                        </p>
                      </div>
                    </SelectItem>
                    <SelectItem value="thinking" className="rounded-md">
                      <div>
                        <p>Thinking</p>
                        <p className="text-xs text-slate-500">
                          Slower, with deeper reasoning and thought steps
                        </p>
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
                <Label>Workflow Type</Label>
                <Select value={workflowType} onValueChange={setWorkflowType}>
                  <SelectTrigger className="rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-lg">
                    <SelectItem value="simple" className="rounded-md">
                      <div>
                        <p>Simple Workflow</p>
                        <p className="text-xs text-slate-500">Standard research → write → review flow</p>
                      </div>
                    </SelectItem>
                    <SelectItem value="observation" className="rounded-md">
                      <div>
                        <p>Observation Workflow</p>
                        <p className="text-xs text-slate-500">Plan → Approve → Execute → Review (multi-phase)</p>
                      </div>
                    </SelectItem>
                    {/* Add more workflow types here as you create them */}
                    {/* <SelectItem value="advanced" className="rounded-md">
                      <div>
                        <p>Advanced Workflow</p>
                        <p className="text-xs text-slate-500">Multi-agent collaboration with quality checks</p>
                      </div>
                    </SelectItem> */}
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
                    <span className="text-slate-600">Execution:</span>
                    <span className="text-slate-900 capitalize">
                      {reportExecution === "thinking" ? "Thinking" : "Fast"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Processing:</span>
                    <span className="text-slate-900">{processingMode === "IMAGE_AND_TEXT" ? "Image & Text" : "Text Only"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">AI Model:</span>
                    <span className="text-slate-900 capitalize">{modelProvider}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Workflow:</span>
                    <span className="text-slate-900 capitalize">{workflowType}</span>
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