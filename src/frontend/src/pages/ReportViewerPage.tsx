"use client";

import { useState, Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppHeader } from "@/frontend/pages/smart_components/AppHeader";
import { Page } from "@/app/pages/config/routes";
import { Project, PeerReview, ReportContent, Photo } from "@/frontend/types";
import { RequestPeerReviewModal } from "@/frontend/pages/large_modal_components/RequestPeerReviewModal";
import { RatingModal } from "@/frontend/pages/large_modal_components/RatingModal";
import { ReportLayout } from "@/frontend/pages/shared_ui_components/ReportLayout";
import { ROUTES, getRoute } from "@/app/pages/config/routes";

function ReportViewerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reportId = searchParams.get("id"); // string
  const fromPeerReview = searchParams.get("fromPeerReview") === "true";
  
  const [isLoading, setIsLoading] = useState(false);

  // Project Context
  const [projectId, setProjectId] = useState<string>("");
  const [projectName, setProjectName] = useState<string>("");

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
  // Use String comparison for IDs
  const assignedReview = peerReviews.find(r => String(r.reportId) === reportId && r.assignedToId === currentUserId);

  const [reportContent, setReportContent] = useState<ReportContent>({
    title: "Loading...",
    date: "",
    location: "",
    engineer: "",
    summary: "",
    sections: []
  });

  // Fetch Report
  useEffect(() => {
    if (reportId && reportId !== "0") {
      setIsLoading(true);
      fetch(`/api/report/${reportId}`)
        .then(res => {
            if (!res.ok) throw new Error("Failed to fetch");
            return res.json();
        })
        .then(data => {
            console.log("Fetched report:", data);
            
            if (data.projectId) {
                setProjectId(data.projectId);
                setProjectName("Project");
            }

            setReportContent({
                title: data.title || "Untitled Report",
                date: new Date(data.updatedAt).toLocaleDateString(),
                location: "Project Site", 
                engineer: "AI Assistant",
                summary: "Executive Summary...",
                sections: data.sections ? data.sections.map((s: any) => ({
                    id: s.id || Math.random().toString(),
                    title: s.sectionTitle || "Untitled Section",
                    content: s.content || "",
                    images: s.images || []
                })) : []
            });
            setReportStatus(data.status || "Draft");
        })
        .catch(err => console.error("Error fetching report:", err))
        .finally(() => setIsLoading(false));
    }
  }, [reportId]);

  const handleNavigate = (page: Page) => {
    router.push(getRoute(page));
  };

  const handleLogout = () => {
    router.push(ROUTES.login);
  };

  const handleBack = () => {
    if (fromPeerReview) {
      router.push(ROUTES.dashboard);
    } else if (projectId) {
      router.push(ROUTES.project(projectId));
    } else {
      router.push(ROUTES.dashboard);
    }
  };

  const handleContentChange = (updates: Partial<ReportContent>) => {
    setReportContent(prev => ({ ...prev, ...updates }));
    console.log("Auto-saving...", updates);
  };

  const handleSectionChange = (sectionId: number | string, newContent: string) => {
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
      Number(reportId) || 0, // Mock needs number, but reportId is string
      reportContent.title,
      projectName || "Unknown Project",
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

  const handleAddHighlightComment = (reviewId: number, highlightedText: string, sectionId: number | string, comment: string, type: "comment" | "suggestion" | "issue" | "question") => {
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

  if (isLoading) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
            <div className="text-slate-500">Loading Report...</div>
        </div>
      );
  }

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
