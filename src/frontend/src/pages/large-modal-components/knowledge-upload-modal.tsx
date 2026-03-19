import { useState } from "react";
import { Button } from "../ui_components/button";
import { Input } from "../ui_components/input";
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
import { Upload, FileText, X, File, Plus } from "lucide-react";
import { KnowledgeDocument } from "@/frontend/types";

interface KnowledgeUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpload: (document: Omit<KnowledgeDocument, "id" | "uploadDate">, files: File[]) => void;
}

const documentTypes = [
  { value: "specification", label: "Technical Specification", icon: "📋" },
  { value: "previous_report", label: "Previous Report", icon: "📊" },
  { value: "other", label: "Other", icon: "📄" },
];

export function KnowledgeUploadModal({ open, onOpenChange, onUpload }: KnowledgeUploadModalProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [documentType, setDocumentType] = useState<string>("specification");
  const [isDragging, setIsDragging] = useState(false);

  const handleFileSelect = (files: File[]) => {
    setSelectedFiles(prev => [...prev, ...files]);
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files) {
      handleFileSelect(Array.from(e.dataTransfer.files));
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
    if (selectedFiles.length === 0) return;

    // Calculate total size for display purposes (just sum of all files)
    const totalSizeKB = (selectedFiles.reduce((acc, file) => acc + file.size, 0) / 1024).toFixed(2);
    const fileExtension = selectedFiles.length === 1 ? selectedFiles[0].name.split('.').pop() || '' : 'Multiple';

    onUpload({
      name: selectedFiles.length === 1 ? selectedFiles[0].name : `${selectedFiles.length} files`, // Placeholder name, handled individually in parent
      type: documentType as KnowledgeDocument["type"],
      description: "",
      fileSize: `${totalSizeKB} KB`,
      fileType: fileExtension.toUpperCase(),
    }, selectedFiles);

    // Reset form
    setSelectedFiles([]);
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
      <DialogContent className="w-[min(600px,95vw)] max-w-[95vw] rounded-xl max-h-[90vh] overflow-x-hidden overflow-y-auto">
        <DialogHeader className="min-w-0">
          <DialogTitle>Upload Knowledge Documents</DialogTitle>
          <DialogDescription>
            Add reference materials that AI will use when generating and editing reports
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4 min-w-0">
          {/* File Upload Area */}
          <div className="min-w-0">
            <label className="text-sm text-slate-700 mb-2 block">Document Files</label>
            <div
              className={`border-2 border-dashed rounded-xl p-4 sm:p-6 text-center transition-all min-w-0 overflow-hidden ${
                isDragging
                  ? "border-theme-primary bg-theme-primary-10"
                  : "border-slate-300 hover:border-slate-400"
              }`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              {selectedFiles.length > 0 ? (
                <div className="space-y-2 max-h-[40vh] overflow-y-auto overflow-x-hidden min-w-0">
                  {selectedFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200 min-w-0">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-theme-primary-10 rounded-lg flex items-center justify-center flex-shrink-0">
                          <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-theme-primary" />
                        </div>
                        <div className="text-left min-w-0 overflow-hidden flex-1">
                          <p className="text-sm text-slate-900 truncate" title={file.name}>{file.name}</p>
                          <p className="text-xs text-slate-500 truncate">{formatFileSize(file.size)}</p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-lg h-8 w-8 flex-shrink-0 text-slate-400 hover:text-red-500"
                        onClick={() => handleRemoveFile(index)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  <div className="pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const input = document.createElement("input");
                        input.type = "file";
                        input.multiple = true;
                        input.accept = ".pdf,.doc,.docx,.txt,.xls,.xlsx";
                        input.onchange = (e) => {
                          const files = (e.target as HTMLInputElement).files;
                          if (files) handleFileSelect(Array.from(files));
                        };
                        input.click();
                      }}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add More Files
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  <Upload className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                  <p className="text-sm text-slate-700 mb-1">
                    Drag and drop your files here, or click to browse
                  </p>
                  <p className="text-xs text-slate-500 mb-4">
                    DOCX, TXT, or Excel files up to 50MB
                  </p>
                  <Button
                    variant="outline"
                    className="rounded-lg"
                    onClick={() => {
                      const input = document.createElement("input");
                      input.type = "file";
                      input.multiple = true;
                      input.accept = ".pdf,.doc,.docx,.txt,.xls,.xlsx";
                      input.onchange = (e) => {
                        const files = (e.target as HTMLInputElement).files;
                        if (files) handleFileSelect(Array.from(files));
                      };
                      input.click();
                    }}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Choose Files
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
            <p className="text-xs text-slate-500 mt-1">Applies to all uploaded files</p>
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
            disabled={selectedFiles.length === 0}
            className="bg-theme-primary hover:bg-theme-primary-hover text-white rounded-lg"
          >
            <Upload className="w-4 h-4 mr-2" />
            Upload {selectedFiles.length > 0 ? `(${selectedFiles.length})` : ''}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
