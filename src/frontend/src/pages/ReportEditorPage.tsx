import { useState } from "react";
import { AppHeader } from "./smart_components/AppHeader";
import { Page } from "@/app/pages/config/routes";
import { ReportLayout, ReportContent } from "./shared_ui_components/ReportLayout";
import { ExportModal } from "./large_modal_components/ExportModal";

interface ReportEditorPageProps {
  onNavigate: (page: Page) => void;
  onLogout: () => void;
}

const mockPhotos = [
  { id: 1, url: "https://images.unsplash.com/photo-1599995903128-531fc7fb694b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb25zdHJ1Y3Rpb24lMjBzaXRlfGVufDF8fHx8MTc2Mjg2NTEwNnww&ixlib=rb-4.1.0&q=80&w=1080", caption: "Site Overview" },
  { id: 2, url: "https://images.unsplash.com/photo-1691947563165-28011f40d786?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxidWlsZGluZyUyMGluZnJhc3RydWN0dXJlfGVufDF8fHx8MTc2Mjg5NTU4Mnww&ixlib=rb-4.1.0&q=80&w=1080", caption: "Foundation Assessment" },
  { id: 3, url: "https://images.unsplash.com/photo-1645258044234-f4ba2655baf1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxlbmdpbmVlcmluZyUyMGVxdWlwbWVudHxlbnwxfHx8fDE3NjI4OTU1ODJ8MA&ixlib=rb-4.1.0&q=80&w=1080", caption: "Structural Elements" },
];

export function ReportEditorPage({ onNavigate, onLogout }: ReportEditorPageProps) {
  const [showExportModal, setShowExportModal] = useState(false);
  const [reportStatus, setReportStatus] = useState("Draft");
  
  const [reportContent, setReportContent] = useState<ReportContent>({
    title: "Foundation Assessment - Section A",
    date: "November 10, 2025",
    location: "Route 95, Section A",
    engineer: "John Doe, P.E.",
    summary: "Based on the site inspection conducted on November 10, 2025, the following observations were made: The foundation structure appears to be in good condition with no visible signs of cracking or deterioration. The concrete quality meets the specified standards with proper curing evident. Load-bearing elements show appropriate alignment and structural integrity.",
    sections: [
      {
        id: 1,
        title: "Executive Summary",
        content: "The foundation assessment of Section A reveals satisfactory structural conditions with minor observations requiring attention. All critical load-bearing elements meet design specifications and show proper installation. No structural deficiencies were identified that would prevent project progression."
      },
      {
        id: 2,
        title: "Site Conditions",
        content: "Weather conditions during inspection were optimal with clear visibility and dry conditions. Ambient temperature measured at 72°F with minimal wind. Site access was unobstructed allowing thorough examination of all foundation elements."
      },
      {
        id: 3,
        title: "Structural Observations",
        content: "Foundation piers are level and properly cured with no visible cracking or settlement issues. Steel reinforcement placement meets specifications with correct spacing and cover depth. Load-bearing capacity appears adequate for design requirements. Minor surface wear noted on eastern support columns consistent with normal weathering patterns."
      },
      {
        id: 4,
        title: "Material Assessment",
        content: "Concrete samples show proper mix consistency and compressive strength within acceptable range. No segregation or honeycombing observed. Surface finish quality is satisfactory with minimal blemishes. Reinforcement bars show no signs of corrosion or deterioration."
      },
      {
        id: 5,
        title: "Recommendations",
        content: "1. Continue monitoring foundation settlement over next 30 days\n2. Apply protective coating to eastern support columns to prevent further weathering\n3. Schedule follow-up inspection after next construction phase\n4. Verify load test results before proceeding with upper structural elements\n5. Document any observed changes in environmental conditions"
      }
    ]
  });

  const handleContentChange = (updates: Partial<ReportContent>) => {
    setReportContent(prev => ({ ...prev, ...updates }));
    console.log("Auto-saving...", updates);
  };

  const handleSectionChange = (sectionId: number, newContent: string) => {
    const updatedSections = reportContent.sections.map(s =>
      s.id === sectionId ? { ...s, content: newContent } : s
    );
    handleContentChange({ sections: updatedSections });
  };

  const handleSave = () => {
    console.log("Saving report...", reportContent);
    // In production, this would call an API to save the report
  };

  const handleExport = () => {
    setShowExportModal(true);
  };

  const handleBack = () => {
    onNavigate("dashboard");
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <AppHeader currentPage="editor" onNavigate={onNavigate} onLogout={onLogout} />
      
      <ReportLayout
        mode="edit"
        reportContent={reportContent}
        onContentChange={handleContentChange}
        onSectionChange={handleSectionChange}
        onBack={handleBack}
        backLabel="Back to Dashboard"
        photos={mockPhotos}
        reportStatus={reportStatus}
        onStatusChange={setReportStatus}
        onExport={handleExport}
        onSave={handleSave}
        showSaveButton={true}
      />

      <ExportModal
        open={showExportModal}
        onOpenChange={setShowExportModal}
        reportTitle={reportContent.title}
      />
    </div>
  );
}
