import { useState } from "react";
import { Button } from "../ui_components/button";
import { Input } from "../ui_components/input";
import { Textarea } from "../ui_components/textarea";
import { Badge } from "../ui_components/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Upload, FileText, X, File } from "lucide-react";
import { KnowledgeDocument } from "@/frontend/types";

interface KnowledgeUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpload: (document: Omit<KnowledgeDocument, "id" | "uploadDate">) => void;
}

const documentTypes = [
  { value: "specification", label: "Technical Specification", icon: "📋" },
  { value: "standard", label: "Industry Standard", icon: "⚖️" },
  { value: "previous_report", label: "Previous Report", icon: "📊" },
  { value: "guideline", label: "Project Guideline", icon: "📖" },
  { value: "reference", label: "Reference Material", icon: "📚" },
  { value: "job_sheet", label: "Job Sheet", icon: "💼" },
  { value: "other", label: "Other", icon: "📄" },
];

export function KnowledgeUploadModal({ open, onOpenChange, onUpload }: KnowledgeUploadModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState<string>("specification");
  const [description, setDescription] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleUpload = () => {
    if (!selectedFile) return;

    const fileExtension = selectedFile.name.split('.').pop() || '';
    const fileSizeKB = (selectedFile.size / 1024).toFixed(2);

    onUpload({
      name: selectedFile.name,
      type: documentType as KnowledgeDocument["type"],
      description,
      fileSize: `${fileSizeKB} KB`,
      fileType: fileExtension.toUpperCase(),
    });

    // Reset form
    setSelectedFile(null);
    setDescription("");
    setDocumentType("specification");
    onOpenChange(false);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] rounded-xl">
        <DialogHeader>
          <DialogTitle>Upload Knowledge Document</DialogTitle>
          <DialogDescription>
            Add reference materials that AI will use when generating and editing reports
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* File Upload Area */}
          <div>
            <label className="text-sm text-slate-700 mb-2 block">Document File</label>
            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                isDragging
                  ? "border-theme-primary bg-theme-primary-10"
                  : selectedFile
                  ? "border-green-300 bg-green-50"
                  : "border-slate-300 hover:border-slate-400"
              }`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              {selectedFile ? (
                <div className="flex items-center justify-center gap-4">
                  <div className="w-12 h-12 bg-theme-primary-10 rounded-lg flex items-center justify-center">
                    <FileText className="w-6 h-6 text-theme-primary" />
                  </div>
                  <div className="text-left flex-1">
                    <p className="text-sm text-slate-900">{selectedFile.name}</p>
                    <p className="text-xs text-slate-500">{formatFileSize(selectedFile.size)}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-lg"
                    onClick={() => setSelectedFile(null)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div>
                  <Upload className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                  <p className="text-sm text-slate-700 mb-1">
                    Drag and drop your file here, or click to browse
                  </p>
                  <p className="text-xs text-slate-500 mb-4">
                    PDF, DOCX, TXT, or Excel files up to 50MB
                  </p>
                  <Button
                    variant="outline"
                    className="rounded-lg"
                    onClick={() => {
                      const input = document.createElement("input");
                      input.type = "file";
                      input.accept = ".pdf,.doc,.docx,.txt,.xls,.xlsx";
                      input.onchange = (e) => {
                        const file = (e.target as HTMLInputElement).files?.[0];
                        if (file) handleFileSelect(file);
                      };
                      input.click();
                    }}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Choose File
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Document Type */}
          <div>
            <label className="text-sm text-slate-700 mb-2 block">Document Type</label>
            <Select value={documentType} onValueChange={setDocumentType}>
              <SelectTrigger className="rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-lg">
                {documentTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value} className="rounded-md">
                    <span className="mr-2">{type.icon}</span>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div>
            <label className="text-sm text-slate-700 mb-2 block">
              Description
              <span className="text-slate-400 ml-1">(Optional)</span>
            </label>
            <Textarea
              placeholder="Briefly describe what this document contains and how it should be used..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="rounded-lg resize-none"
              rows={3}
            />
          </div>

          {/* Info Box */}
          <div className="bg-theme-primary-10 border border-theme-primary-30 rounded-lg p-4">
            <p className="text-sm text-slate-900">
              <strong>How AI uses this knowledge:</strong> When generating or editing reports, 
              the AI will reference these documents to ensure compliance with standards, 
              maintain consistency with previous reports, and follow project-specific guidelines.
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-lg"
          >
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            disabled={!selectedFile}
            className="bg-theme-primary hover:bg-theme-primary-hover text-white rounded-lg"
          >
            <Upload className="w-4 h-4 mr-2" />
            Upload Document
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}