"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppHeader } from "@/frontend/pages/smart_components/AppHeader";
import { Page } from "@/app/pages/config/routes";
import { Project, PeerReview } from "@/frontend/types";
import { RequestPeerReviewModal } from "@/frontend/pages/large_modal_components/RequestPeerReviewModal";
import { RatingModal } from "@/frontend/pages/large_modal_components/RatingModal";
import { ReportLayout, ReportContent } from "@/frontend/pages/shared_ui_components/ReportLayout";

const mockPhotos = [
  {
    id: 1,
    url: "https://images.unsplash.com/photo-1599995903128-531fc7fb694b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb25zdHJ1Y3Rpb24lMjBzaXRlfGVufDF8fHx8MTc2Mjg2NTEwNnww&ixlib=rb-4.1.0&q=80&w=1080",
    caption: "Foundation overview - Section A"
  },
  {
    id: 2,
    url: "https://images.unsplash.com/photo-1691947563165-28011f40d786?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxidWlsZGluZyUyMGluZnJhc3RydWN0dXJlfGVufDF8fHx8MTc2Mjg5NTU4Mnww&ixlib=rb-4.1.0&q=80&w=1080",
    caption: "Structural support elements"
  },
];

import { ROUTES, getRoute } from "@/app/pages/config/routes";

function ReportViewerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reportId = parseInt(searchParams.get("id") || "0");
  const fromPeerReview = searchParams.get("fromPeerReview") === "true";
  
  // Mock Project Data (Ideally fetch based on reportId or passed project)
  const project: Project = {
      id: 1,
      name: "Bridge Inspection - Route 95",
      reports: 12,
      photos: 156,
      status: "Active",
      lastUpdated: "2025-11-18"
  };

  // Mock Peer Reviews State
  const [peerReviews, setPeerReviews] = useState<PeerReview[]>([
      {
        id: 1,
        reportId: 1,
        reportTitle: "Foundation Assessment - Phase 1",
        projectName: "Downtown Tower Complex",
        requestedById: 1,
        requestedByName: "John Davis",
        assignedToId: 2,
        assignedToName: "Sarah Johnson",
        status: "pending",
        requestDate: "2025-11-12",
        requestNotes: "Please review the concrete strength test results in Section 3.",
        comments: []
      }
  ]);

  const [reportStatus, setReportStatus] = useState("Draft");
  const [isRequestPeerReviewModalOpen, setIsRequestPeerReviewModalOpen] = useState(false);
  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);

  const currentUserId = 2;
  const assignedReview = peerReviews.find(r => r.reportId === reportId && r.assignedToId === currentUserId);

  const [reportContent, setReportContent] = useState<ReportContent>({
    title: "Foundation Assessment - Section A",
    date: "November 10, 2025",
    location: "Route 95, Section A",
    engineer: "John Doe, P.E.",
    summary: "Comprehensive foundation inspection conducted at Route 95, Section A. The assessment evaluates structural integrity, material quality, and compliance with design specifications.",
    sections: [
      {
        id: 1,
        title: "EIFS - West Elevation (Riser 01 and 03)",
        content: "1.1 The installation of 4-inch EPS on the west side, covering balconies and areas between Risers 01 and 03, is now complete. The Contractor must verify that the EPS installation adheres to all relevant project specifications for adhesion, thickness, and integration with surrounding systems.\n\n1.2 0.25-inch x 5-inch Tapcons with plastic washers were observed installed at the top and bottom at 24 inches on center on the west elevation (Risers 01 and 03). At the top two floors, a minimum of two fasteners per board were installed.\n\n1.3 Installation should comply with specifications, including maintaining fastener clearance of 75mm (3 inches) minimum from the edge of the insulation board and using depth control devices as required (07 24 00 - Exterior Insulation and Finish Systems)."
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
      },
      {
        id: 6,
        title: "Conclusion",
        content: "Overall foundation conditions are satisfactory for project progression. No critical deficiencies identified during this inspection. Minor maintenance items can be addressed during normal construction activities. Recommend approval to proceed with next phase pending completion of protective measures on support columns."
      }
    ]
  });

  const handleNavigate = (page: Page) => {
    router.push(getRoute(page));
  };

  const handleLogout = () => {
    router.push(ROUTES.login);
  };

  const handleBack = () => {
    if (fromPeerReview) {
      router.push(ROUTES.dashboard);
    } else {
      router.push(ROUTES.project(project.id));
    }
  };

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

  const handleRequestPeerReview = (reportId: number, reportTitle: string, projectName: string, assignedToId: number, assignedToName: string, notes: string) => {
      // Mock implementation
      console.log("Requested peer review:", { reportId, reportTitle, assignedToName, notes });
  };

  const onRequestPeerReview = (userId: number, notes: string) => {
    const userNames: { [key: number]: string } = {
      1: "John Davis",
      3: "Michael Chen",
      4: "Emily Rodriguez",
      5: "David Park",
      6: "Lisa Thompson"
    };

    handleRequestPeerReview(
      reportId,
      reportContent.title,
      project?.name || "Unknown Project",
      userId,
      userNames[userId] || "Unknown User",
      notes
    );
    setIsRequestPeerReviewModalOpen(false);
  };

  const handleAddReviewComment = (reviewId: number, comment: string, type: "comment" | "suggestion" | "issue" | "question") => {
      // Mock implementation
      console.log("Added comment:", { reviewId, comment, type });
  };

  const handleAddHighlightComment = (reviewId: number, highlightedText: string, sectionId: number, comment: string, type: "comment" | "suggestion" | "issue" | "question") => {
      // Mock implementation
      console.log("Added highlight comment:", { reviewId, highlightedText, sectionId, comment, type });
  };

  const handleResolveComment = (reviewId: number, commentId: number) => {
      console.log("Resolved comment:", { reviewId, commentId });
  };

  const handleCompleteReview = (reviewId: number) => {
      console.log("Completed review:", reviewId);
  };

  const handleSubmitReviewWithRating = (rating: number, feedback: string) => {
    if (assignedReview) {
      console.log("Submitting review with rating:", rating, "and feedback:", feedback);
      handleCompleteReview(assignedReview.id);
    }
  };

  const handleExportPDF = () => {
    console.log("Exporting PDF for report:", reportContent.title);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <AppHeader 
        currentPage="dashboard" 
        onNavigate={handleNavigate} 
        onLogout={handleLogout}
        pageTitle={fromPeerReview ? "Peer Review" : "Report Editor"}
      />
      
      <ReportLayout
        mode={fromPeerReview && assignedReview ? "peer-review" : "edit"}
        reportContent={reportContent}
        onContentChange={handleContentChange}
        onSectionChange={handleSectionChange}
        onBack={handleBack}
        backLabel={fromPeerReview ? "Back to Dashboard" : "Back to Project"}
        photos={mockPhotos}
        reportStatus={reportStatus}
        onStatusChange={setReportStatus}
        onRequestPeerReview={!fromPeerReview ? () => setIsRequestPeerReviewModalOpen(true) : undefined}
        onExport={handleExportPDF}
        peerReview={assignedReview}
        onAddReviewComment={assignedReview ? (comment, type) => handleAddReviewComment(assignedReview.id, comment, type) : undefined}
        onAddHighlightComment={assignedReview ? (text, sectionId, comment, type) => handleAddHighlightComment(assignedReview.id, text, sectionId, comment, type) : undefined}
        onResolveComment={assignedReview ? (commentId) => handleResolveComment(assignedReview.id, commentId) : undefined}
        onCompleteReview={assignedReview ? () => handleCompleteReview(assignedReview.id) : undefined}
        onOpenRatingModal={() => setIsRatingModalOpen(true)}
      />

      <RequestPeerReviewModal
        open={isRequestPeerReviewModalOpen}
        onOpenChange={setIsRequestPeerReviewModalOpen}
        reportTitle={reportContent.title}
        currentUserId={currentUserId}
        onRequestReview={onRequestPeerReview}
      />

      <RatingModal
        open={isRatingModalOpen}
        onOpenChange={setIsRatingModalOpen}
        reportTitle={reportContent.title}
        onSubmitReview={handleSubmitReviewWithRating}
      />
    </div>
  );
}

export function ReportViewerPage() {
  return (
    <Suspense fallback={<div>Loading report...</div>}>
      <ReportViewerContent />
    </Suspense>
  );
}