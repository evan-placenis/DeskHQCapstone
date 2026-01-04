import { Button } from "../ui_components/button";
import { Label } from "../ui_components/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui_components/select";
import { Slider } from "../ui_components/slider";
import { Switch } from "../ui_components/switch";
import { Separator } from "../ui_components/separator";
import { X, Sparkles } from "lucide-react";

interface AISettingsPanelProps {
  onClose: () => void;
}

export function AISettingsPanel({ onClose }: AISettingsPanelProps) {
  return (
    <div className="w-80 bg-white border-l border-slate-200 flex flex-col">
      <CardHeader className="border-b border-slate-200 p-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-theme-primary" />
          <h3 className="text-slate-900">AI Settings</h3>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="rounded-lg">
          <X className="w-4 h-4" />
        </Button>
      </CardHeader>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div>
          <Label htmlFor="tone">Report Tone</Label>
          <Select defaultValue="professional">
            <SelectTrigger className="rounded-lg mt-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="professional">Professional</SelectItem>
              <SelectItem value="technical">Technical</SelectItem>
              <SelectItem value="concise">Concise</SelectItem>
              <SelectItem value="detailed">Detailed</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-slate-500 mt-1">
            Choose the writing style for generated reports
          </p>
        </div>

        <div>
          <Label htmlFor="template">Report Template</Label>
          <Select defaultValue="inspection">
            <SelectTrigger className="rounded-lg mt-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="inspection">Standard Inspection</SelectItem>
              <SelectItem value="safety">Safety Assessment</SelectItem>
              <SelectItem value="quality">Quality Control</SelectItem>
              <SelectItem value="progress">Progress Report</SelectItem>
              <SelectItem value="custom">Custom Template</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-slate-500 mt-1">
            Select the structure for your report
          </p>
        </div>

        <Separator />

        <div>
          <div className="flex items-center justify-between mb-3">
            <Label>Detail Level</Label>
            <span className="text-sm text-slate-600">High</span>
          </div>
          <Slider defaultValue={[75]} max={100} step={1} className="mb-2" />
          <p className="text-xs text-slate-500">
            Control how much detail the AI includes
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <Label>Technical Language</Label>
            <span className="text-sm text-slate-600">Medium</span>
          </div>
          <Slider defaultValue={[50]} max={100} step={1} className="mb-2" />
          <p className="text-xs text-slate-500">
            Adjust the level of technical terminology
          </p>
        </div>

        <Separator />

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Include Photo References</Label>
              <p className="text-xs text-slate-500">Link photos to report sections</p>
            </div>
            <Switch defaultChecked />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Auto-Generate Summary</Label>
              <p className="text-xs text-slate-500">Create executive summary</p>
            </div>
            <Switch defaultChecked />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Include Recommendations</Label>
              <p className="text-xs text-slate-500">AI suggests next steps</p>
            </div>
            <Switch />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Safety Highlight Mode</Label>
              <p className="text-xs text-slate-500">Emphasize safety concerns</p>
            </div>
            <Switch defaultChecked />
          </div>
        </div>

        <Separator />

        <div>
          <Label>Language</Label>
          <Select defaultValue="en">
            <SelectTrigger className="rounded-lg mt-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="es">Spanish</SelectItem>
              <SelectItem value="fr">French</SelectItem>
              <SelectItem value="de">German</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="p-4 border-t border-slate-200">
        <Button className="w-full bg-theme-primary hover:bg-theme-primary-hover text-white rounded-lg">
          <Sparkles className="w-4 h-4 mr-2" />
          Apply Settings
        </Button>
      </div>
    </div>
  );
}