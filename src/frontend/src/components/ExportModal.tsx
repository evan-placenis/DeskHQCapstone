import { useState } from "react";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Checkbox } from "./ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Card } from "./ui/card";
import { FileText, Download, CheckCircle2 } from "lucide-react";

interface ExportModalProps {
  onClose: () => void;
}

export function ExportModal({ onClose }: ExportModalProps) {
  const [selectedFormats, setSelectedFormats] = useState({
    pdf: true,
    docx: false,
    html: false,
  });
  const [isExporting, setIsExporting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  const handleExport = () => {
    setIsExporting(true);
    setTimeout(() => {
      setIsExporting(false);
      setIsComplete(true);
      setTimeout(() => {
        onClose();
      }, 1500);
    }, 2000);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] rounded-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="w-5 h-5 text-blue-600" />
            Export Report
          </DialogTitle>
          <DialogDescription>
            Choose your export format and options
          </DialogDescription>
        </DialogHeader>

        {!isComplete ? (
          <>
            <div className="space-y-4 py-4">
              <Card className="p-4 rounded-lg border-slate-200 bg-slate-50">
                <div className="flex items-start gap-3">
                  <FileText className="w-5 h-5 text-slate-600 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="text-sm text-slate-900 mb-1">
                      Foundation Assessment - Section A
                    </h4>
                    <p className="text-xs text-slate-600">Bridge Inspection - Route 95</p>
                    <p className="text-xs text-slate-500 mt-2">Date: November 10, 2025</p>
                  </div>
                </div>
              </Card>

              <div className="space-y-3">
                <Label>Export Format</Label>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="pdf"
                      checked={selectedFormats.pdf}
                      onCheckedChange={(checked) =>
                        setSelectedFormats({ ...selectedFormats, pdf: !!checked })
                      }
                    />
                    <label
                      htmlFor="pdf"
                      className="text-sm cursor-pointer flex-1"
                    >
                      PDF Document (.pdf)
                      <span className="text-xs text-slate-500 ml-2">Recommended</span>
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="docx"
                      checked={selectedFormats.docx}
                      onCheckedChange={(checked) =>
                        setSelectedFormats({ ...selectedFormats, docx: !!checked })
                      }
                    />
                    <label
                      htmlFor="docx"
                      className="text-sm cursor-pointer flex-1"
                    >
                      Word Document (.docx)
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="html"
                      checked={selectedFormats.html}
                      onCheckedChange={(checked) =>
                        setSelectedFormats({ ...selectedFormats, html: !!checked })
                      }
                    />
                    <label
                      htmlFor="html"
                      className="text-sm cursor-pointer flex-1"
                    >
                      HTML File (.html)
                    </label>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Include</Label>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="photos" defaultChecked />
                    <label htmlFor="photos" className="text-sm cursor-pointer">
                      Site Photos
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="metadata" defaultChecked />
                    <label htmlFor="metadata" className="text-sm cursor-pointer">
                      Metadata & Properties
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="signature" />
                    <label htmlFor="signature" className="text-sm cursor-pointer">
                      Digital Signature
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={onClose} className="rounded-lg">
                Cancel
              </Button>
              <Button
                onClick={handleExport}
                disabled={!selectedFormats.pdf && !selectedFormats.docx && !selectedFormats.html}
                className="bg-blue-600 hover:bg-blue-700 rounded-lg"
              >
                {isExporting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Export Report
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <div className="py-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-slate-900 mb-2">Export Complete!</h3>
            <p className="text-sm text-slate-600">Your report has been exported successfully</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
