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
import { Upload, X, Image as ImageIcon, FolderPlus, Music } from "lucide-react";
import { PhotoFolder } from "@/frontend/types";

interface PhotoUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingFolders: PhotoFolder[];
  onUpload: (files: File[], folderId: number, folderName?: string) => void;
}

export function PhotoUploadModal({ 
  open, 
  onOpenChange, 
  existingFolders,
  onUpload 
}: PhotoUploadModalProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedAudioFiles, setSelectedAudioFiles] = useState<File[]>([]);
  const [folderOption, setFolderOption] = useState<"existing" | "new">("new");
  const [selectedFolderId, setSelectedFolderId] = useState<string>("");
  const [newFolderName, setNewFolderName] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isAudioDragging, setIsAudioDragging] = useState(false);

  // Auto-generate folder name with today's date
  const generateFolderName = () => {
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    const siteVisitNumber = existingFolders.length + 1;
    return `Site Visit ${siteVisitNumber} - ${dateStr} - `;
  };

  const handleFileSelect = (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter(file => 
      file.type.startsWith('image/')
    );
    setSelectedFiles([...selectedFiles, ...fileArray]);
  };

  const handleAudioFileSelect = (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter(file => 
      file.type.startsWith('audio/')
    );
    setSelectedAudioFiles([...selectedAudioFiles, ...fileArray]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files) {
      handleFileSelect(e.dataTransfer.files);
    }
  };

  const handleAudioDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsAudioDragging(false);
    
    if (e.dataTransfer.files) {
      handleAudioFileSelect(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleAudioDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsAudioDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleAudioDragLeave = () => {
    setIsAudioDragging(false);
  };

  const removeFile = (index: number) => {
    setSelectedFiles(selectedFiles.filter((_, i) => i !== index));
  };

  const removeAudioFile = (index: number) => {
    setSelectedAudioFiles(selectedAudioFiles.filter((_, i) => i !== index));
  };

  const handleUpload = () => {
    if (selectedFiles.length === 0) return;

    if (folderOption === "new" && !newFolderName.trim()) {
      alert("Please enter a folder name");
      return;
    }

    if (folderOption === "existing" && !selectedFolderId) {
      alert("Please select a folder");
      return;
    }

    const folderId = folderOption === "new" 
      ? -1 // Signal to create new folder
      : parseInt(selectedFolderId);

    const folderName = folderOption === "new" ? newFolderName : undefined;

    // TODO: In production, handle audio files upload separately
    console.log("Audio files to upload:", selectedAudioFiles);

    onUpload(selectedFiles, folderId, folderName);

    // Reset form
    setSelectedFiles([]);
    setSelectedAudioFiles([]);
    setNewFolderName("");
    setSelectedFolderId("");
    setFolderOption("new");
    onOpenChange(false);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px] rounded-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload Photos</DialogTitle>
          <DialogDescription>
            Upload site photos and organize them into folders
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Folder Selection */}
          <div>
            <label className="text-sm text-slate-700 mb-3 block">Organize Into Folder</label>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <button
                className={`p-4 border-2 rounded-lg text-left transition-all ${
                  folderOption === "new"
                    ? "border-theme-action-primary bg-theme-primary-5"
                    : "border-slate-200 hover:border-slate-300"
                }`}
                onClick={() => setFolderOption("new")}
              >
                <FolderPlus className="w-5 h-5 text-theme-primary mb-2" />
                <p className="text-sm text-slate-900">New Folder</p>
                <p className="text-xs text-slate-500">Create a new site visit</p>
              </button>
              <button
                className={`p-4 border-2 rounded-lg text-left transition-all ${
                  folderOption === "existing"
                    ? "border-theme-action-primary bg-theme-primary-5"
                    : "border-slate-200 hover:border-slate-300"
                }`}
                onClick={() => setFolderOption("existing")}
              >
                <ImageIcon className="w-5 h-5 text-theme-primary mb-2" />
                <p className="text-sm text-slate-900">Existing Folder</p>
                <p className="text-xs text-slate-500">Add to existing visit</p>
              </button>
            </div>

            {folderOption === "new" ? (
              <div>
                <label className="text-sm text-slate-700 mb-2 block">Folder Name</label>
                <Input
                  placeholder={generateFolderName()}
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  className="rounded-lg"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Format: Site Visit # - YYYY-MM-DD - Initials
                </p>
              </div>
            ) : (
              <div>
                <label className="text-sm text-slate-700 mb-2 block">Select Folder</label>
                <Select value={selectedFolderId} onValueChange={setSelectedFolderId}>
                  <SelectTrigger className="rounded-lg">
                    <SelectValue placeholder="Choose a folder..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-lg">
                    {existingFolders.map((folder) => (
                      <SelectItem key={folder.id} value={folder.id.toString()} className="rounded-md">
                        {folder.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* File Upload Area */}
          <div>
            <label className="text-sm text-slate-700 mb-2 block">Photos</label>
            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                isDragging
                  ? "border-theme-action-primary bg-theme-primary-5"
                  : selectedFiles.length > 0
                  ? "border-green-300 bg-green-50"
                  : "border-slate-300 hover:border-slate-400"
              }`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <Upload className="w-10 h-10 text-slate-400 mx-auto mb-3" />
              <p className="text-sm text-slate-700 mb-1">
                Drag and drop photos here, or click to browse
              </p>
              <p className="text-xs text-slate-500 mb-4">
                JPG, PNG, HEIC - Multiple files supported
              </p>
              <Button
                variant="outline"
                className="rounded-lg"
                onClick={() => {
                  const input = document.createElement("input");
                  input.type = "file";
                  input.multiple = true;
                  input.accept = "image/*";
                  input.onchange = (e) => {
                    const files = (e.target as HTMLInputElement).files;
                    if (files) handleFileSelect(files);
                  };
                  input.click();
                }}
              >
                <Upload className="w-4 h-4 mr-2" />
                Choose Files
              </Button>
            </div>
          </div>

          {/* Audio File Upload Area */}
          <div>
            <label className="text-sm text-slate-700 mb-2 block">Audio Files</label>
            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                isAudioDragging
                  ? "border-theme-action-primary bg-theme-primary-5"
                  : selectedAudioFiles.length > 0
                  ? "border-green-300 bg-green-50"
                  : "border-slate-300 hover:border-slate-400"
              }`}
              onDrop={handleAudioDrop}
              onDragOver={handleAudioDragOver}
              onDragLeave={handleAudioDragLeave}
            >
              <Music className="w-10 h-10 text-slate-400 mx-auto mb-3" />
              <p className="text-sm text-slate-700 mb-1">
                Drag and drop audio files here, or click to browse
              </p>
              <p className="text-xs text-slate-500 mb-4">
                MP3, WAV - Multiple files supported
              </p>
              <Button
                variant="outline"
                className="rounded-lg"
                onClick={() => {
                  const input = document.createElement("input");
                  input.type = "file";
                  input.multiple = true;
                  input.accept = "audio/*";
                  input.onchange = (e) => {
                    const files = (e.target as HTMLInputElement).files;
                    if (files) handleAudioFileSelect(files);
                  };
                  input.click();
                }}
              >
                <Music className="w-4 h-4 mr-2" />
                Choose Files
              </Button>
            </div>
          </div>

          {/* Selected Files List */}
          {selectedFiles.length > 0 && (
            <div>
              <label className="text-sm text-slate-700 mb-2 block">
                Selected Photos ({selectedFiles.length})
              </label>
              <div className="space-y-2 max-h-[200px] overflow-y-auto border border-slate-200 rounded-lg p-3">
                {selectedFiles.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 bg-slate-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 bg-theme-primary-10 rounded-lg flex items-center justify-center flex-shrink-0">
                        <ImageIcon className="w-5 h-5 text-theme-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-900 truncate">{file.name}</p>
                        <p className="text-xs text-slate-500">{formatFileSize(file.size)}</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="rounded-lg h-8 w-8 flex-shrink-0"
                      onClick={() => removeFile(index)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Selected Audio Files List */}
          {selectedAudioFiles.length > 0 && (
            <div>
              <label className="text-sm text-slate-700 mb-2 block">
                Selected Audio Files ({selectedAudioFiles.length})
              </label>
              <div className="space-y-2 max-h-[200px] overflow-y-auto border border-slate-200 rounded-lg p-3">
                {selectedAudioFiles.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 bg-slate-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 bg-theme-primary-10 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Music className="w-5 h-5 text-theme-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-900 truncate">{file.name}</p>
                        <p className="text-xs text-slate-500">{formatFileSize(file.size)}</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="rounded-lg h-8 w-8 flex-shrink-0"
                      onClick={() => removeAudioFile(index)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Info Box */}
          <div className="bg-theme-primary-5 border border-theme-primary-20 rounded-lg p-4">
            <p className="text-sm text-slate-900">
              <strong>Tip:</strong> Organize photos by site visit to keep your project organized. 
              You can add descriptions to individual photos after uploading.
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
            className="bg-theme-action-primary hover:bg-theme-action-primary-hover rounded-lg"
          >
            <Upload className="w-4 h-4 mr-2" />
            Upload {selectedFiles.length > 0 && `(${selectedFiles.length})`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}