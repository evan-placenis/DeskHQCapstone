import { useState } from "react";
import { Button } from "../ui_components/button";
import { Input } from "../ui_components/input";
import { Label } from "../ui_components/label";
import { Textarea } from "../ui_components/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui_components/dialog";
import { Project } from "../../App";
import { Upload, FileSpreadsheet, X } from "lucide-react";
import * as XLSX from "xlsx";

interface NewProjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateProject: (project: Omit<Project, "id"> & { excelData?: any }) => void;
}

export function NewProjectModal({ open, onOpenChange, onCreateProject }: NewProjectModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [excelData, setExcelData] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check if it's an Excel file
    const validTypes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv'
    ];
    
    if (!validTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls|csv)$/)) {
      alert("Please upload a valid Excel or CSV file");
      return;
    }

    setIsProcessing(true);
    setExcelFile(file);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      
      // Get first sheet
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      // Convert to JSON
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      
      setExcelData({
        fileName: file.name,
        sheets: workbook.SheetNames,
        data: jsonData,
        rowCount: jsonData.length
      });

      // Try to auto-fill project name from Excel if not already set
      if (!name && jsonData.length > 0) {
        const firstRow: any = jsonData[0];
        if (firstRow['Project Name'] || firstRow['project_name'] || firstRow['name']) {
          setName(firstRow['Project Name'] || firstRow['project_name'] || firstRow['name']);
        }
      }

    } catch (error) {
      console.error("Error parsing Excel file:", error);
      alert("Error reading Excel file. Please make sure it's a valid file.");
      setExcelFile(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const removeFile = () => {
    setExcelFile(null);
    setExcelData(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) return;

    const newProject: Omit<Project, "id"> & { excelData?: any } = {
      name: name.trim(),
      status: "Active",
      lastUpdated: new Date().toISOString().split('T')[0],
      reports: 0,
      photos: 0,
      excelData: excelData // Include parsed Excel data
    };

    onCreateProject(newProject);
    
    // Reset form
    setName("");
    setDescription("");
    setExcelFile(null);
    setExcelData(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] rounded-xl">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
          <DialogDescription>
            Start a new engineering project. Optionally upload an Excel file with project data.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Project Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Bridge Inspection - Route 95"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="rounded-lg"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                placeholder="Add project details, location, or notes..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="rounded-lg min-h-[100px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="excel">Upload Project Data (Excel/CSV)</Label>
              <div className="flex flex-col gap-3">
                {!excelFile ? (
                  <div className="relative">
                    <input
                      id="excel"
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleFileUpload}
                      className="hidden"
                      disabled={isProcessing}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full rounded-lg h-24 border-2 border-dashed hover:border-theme-primary hover:bg-theme-primary-10"
                      onClick={() => document.getElementById('excel')?.click()}
                      disabled={isProcessing}
                    >
                      <div className="flex flex-col items-center gap-2">
                        <Upload className="w-6 h-6 text-slate-400" />
                        <div className="text-center">
                          <p className="text-sm">
                            {isProcessing ? "Processing..." : "Click to upload Excel or CSV"}
                          </p>
                          <p className="text-xs text-slate-500">
                            Project details, observations, photos list, etc.
                          </p>
                        </div>
                      </div>
                    </Button>
                  </div>
                ) : (
                  <div className="border-2 border-slate-200 rounded-lg p-4 bg-slate-50">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <FileSpreadsheet className="w-5 h-5 text-green-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-900 truncate">{excelFile.name}</p>
                          <p className="text-xs text-slate-600 mt-1">
                            {excelData?.rowCount} rows parsed from {excelData?.sheets.length} sheet(s)
                          </p>
                          {excelData?.data && excelData.data.length > 0 && (
                            <div className="mt-2 p-2 bg-white rounded border border-slate-200">
                              <p className="text-xs text-slate-600 mb-1">Preview:</p>
                              <p className="text-xs text-slate-800 font-mono">
                                {Object.keys(excelData.data[0]).slice(0, 3).join(", ")}
                                {Object.keys(excelData.data[0]).length > 3 && "..."}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="rounded-lg flex-shrink-0"
                        onClick={removeFile}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Upload Excel files with project information, site locations, or observation data. Data will be stored with the project.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setName("");
                setDescription("");
                setExcelFile(null);
                setExcelData(null);
                onOpenChange(false);
              }}
              className="rounded-lg"
            >
              Cancel
            </Button>
            <Button 
              type="submit"
              className="bg-theme-action-primary hover:bg-theme-action-primary-hover rounded-lg"
            >
              Create Project
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}