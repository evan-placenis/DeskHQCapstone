"use client";

import { useState, Suspense, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppHeader } from "@/frontend/pages/smart_components/AppHeader";
import { Page } from "@/app/pages/config/routes";
import { Project, PeerReview, ReportContent, Photo } from "@/frontend/types";
import { RequestPeerReviewModal } from "@/frontend/pages/large_modal_components/RequestPeerReviewModal";
import { RatingModal } from "@/frontend/pages/large_modal_components/RatingModal";
import { ReportLayout } from "@/frontend/pages/shared_ui_components/ReportLayout";
import { ROUTES, getRoute } from "@/app/pages/config/routes";
import { supabase } from "@/frontend/lib/supabaseClient";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/frontend/pages/ui_components/card";
import { TiptapEditor } from "@/frontend/pages/smart_components/TiptapEditor";

// 🟢 NEW: Component for showing generation progress
const GeneratingReportCard = ({ status, reasoning }: { status: string, reasoning: string }) => (
  <Card className="rounded-xl shadow-md border-2 border-theme-primary bg-blue-50/50 mb-6 animate-in fade-in slide-in-from-top-4 duration-500 mx-auto max-w-4xl mt-8">
    <CardContent className="p-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-theme-primary/20 rounded-full animate-ping"></div>
              <div className="relative w-10 h-10 bg-theme-primary/10 rounded-full flex items-center justify-center">
                <Loader2 className="w-5 h-5 text-theme-primary animate-spin" />
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Generating Report</h3>
              <p className="text-sm text-theme-primary font-medium">{status || "Initializing..."}</p>
            </div>
          </div>
        </div>

        {reasoning && (
          <div className="bg-white rounded-lg p-4 border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-theme-primary"></span>
              AI Thinking Process
            </div>
            <p className="text-sm text-slate-700 font-mono whitespace-pre-wrap leading-relaxed max-h-[60vh] overflow-y-auto">
              {reasoning}
              <span className="inline-block w-2 h-4 ml-1 bg-theme-primary animate-pulse align-middle"></span>
            </p>
          </div>
        )}
      </div>
    </CardContent>
  </Card>
);

function ReportViewerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reportIdParam = searchParams.get("id"); // string
  const fromPeerReview = searchParams.get("fromPeerReview") === "true";
  const generatingParam = searchParams.get("generating") === "true";
  const projectIdParam = searchParams.get("projectId");

  const [reportId, setReportId] = useState(reportIdParam);

  // Generation State
  const [isGenerating, setIsGenerating] = useState(generatingParam);
  const [generationStatus, setGenerationStatus] = useState("Initializing...");
  const [generationReasoning, setGenerationReasoning] = useState("");

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
  const [isSaving, setIsSaving] = useState(false);

  const currentUserId = 2;
  // Use String comparison for IDs
  const assignedReview = peerReviews.find(r => String(r.reportId) === reportId && r.assignedToId === currentUserId);

  // 🟢 NEW: Tiptap content state
  const [markdownContent, setMarkdownContent] = useState("");
  const lastSavedContentRef = useRef<string>(""); // Track what was last saved to prevent unnecessary saves

  //  ReportContent structure for ReportLayout (minimal, just for compatibility)
  const [reportContent, setReportContent] = useState<ReportContent>({
    title: "Loading...",
    date: "",
    location: "",
    engineer: "",
    sections: []
  });

  // Fetch Report
  useEffect(() => {
    // If generating, don't fetch yet
    if (isGenerating) return;

    if (reportId && reportId !== "0") {
      setIsLoading(true);
      fetch(`/api/report/${reportId}`)
        .then(res => {
          if (!res.ok) throw new Error("Failed to fetch");
          return res.json();
        })
        .then(data => {
          console.log("Fetched report:", data);

          if (data.project_id) {
            setProjectId(data.project_id);
            setProjectName("Project");
          }

          // 🟢 NEW: Load tiptap_content (Markdown)
          const tiptapContent = data.tiptap_content || "";
          setMarkdownContent(tiptapContent);
          // Initialize the saved content ref to prevent saving on initial load
          lastSavedContentRef.current = tiptapContent;

          // 🟢 Create minimal ReportContent structure for ReportLayout compatibility
          setReportContent({
            title: data.title || "Untitled Report",
            date: new Date(data.updated_at || Date.now()).toLocaleDateString(),
            location: "Project Site",
            engineer: "AI Assistant",
            sections: [{
              id: "main-content",
              title: "Report Content",
              description: "",
              content: tiptapContent, // Pass markdown content here
              images: [],
              subSections: []
            }]
          });
          setReportStatus(data.status || "Draft");
        })
        .catch(err => console.error("Error fetching report:", err))
        .finally(() => setIsLoading(false));
    }
  }, [reportId, isGenerating]);

  // 🟢 NEW: Supabase Realtime Subscription for Report Generation
  useEffect(() => {
    if (!isGenerating || !projectIdParam) return;

    console.log(`🔌 Subscribing to channel: project-${projectIdParam}`);

    const channel = supabase.channel(`project-${projectIdParam}`)
      .on('broadcast', { event: 'status' }, (payload: any) => {
        setGenerationStatus(payload.payload.chunk);
      })
      .on('broadcast', { event: 'reasoning' }, (payload: any) => {
        setGenerationReasoning(prev => prev + payload.payload.chunk);
      })
      .on('broadcast', { event: 'review_reasoning' }, (payload: any) => {
        setGenerationReasoning(prev => prev + payload.payload.chunk);
      })
      .on('broadcast', { event: 'report_complete' }, (payload: any) => {
        console.log("✅ Report Complete! Loading report...", payload);
        if (payload.payload.reportId) {
          // Update URL without reloading page
          const newUrl = `/pages/report?id=${payload.payload.reportId}`;
          window.history.replaceState({ ...window.history.state, as: newUrl, url: newUrl }, '', newUrl);

          setReportId(payload.payload.reportId);
          setIsGenerating(false);
        }
      })
      .subscribe();

    return () => {
      console.log("🔌 Unsubscribing from channel");
      supabase.removeChannel(channel);
    };
  }, [isGenerating, projectIdParam]);

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
  };

  // 🟢 NEW: Handle section change - update both reportContent and markdownContent
  const handleSectionChange = (sectionId: number | string, newContent: string, newData?: any) => {
    // Update markdownContent (the source of truth for Tiptap)
    setMarkdownContent(newContent);

    // Update reportContent structure for ReportLayout
    const updatedSections = reportContent.sections.map(s => {
      if (s.id === sectionId) {
        return {
          ...s,
          content: newContent,
          ...(newData || {})
        };
      }
      return s;
    });
    handleContentChange({ sections: updatedSections });
  };

  // 2. Auto-Save Logic (Debounced)
  const saveToDatabase = useCallback(async (newContent: string) => {
    if (!reportId) return;

    // Skip save if content hasn't actually changed
    if (newContent === lastSavedContentRef.current) {
      return;
    }
    console.log("💾 FIRING SUPABASE UPDATE NOW...");
    setIsSaving(true);

    try {
      const { error } = await supabase
        .from('reports')
        .update({
          tiptap_content: newContent,
          updated_at: new Date().toISOString()
        })
        .eq('id', reportId);

      if (error) throw error;

      // Update the ref to track what was saved
      lastSavedContentRef.current = newContent;
      console.log("💾 SAVED CONTENT TO DATABASE:");
    } catch (err) {
      console.error("Failed to save:", err);
    } finally {
      setIsSaving(false);
    }
  }, [reportId]);

  // Debounce wrapper for the save function using useRef to properly track timeout
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Clear any existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Only set up debounce if we have content and aren't loading/generating
    if (markdownContent && !isLoading && !isGenerating && reportId) {
      // Set new timeout
      saveTimeoutRef.current = setTimeout(() => {
        saveToDatabase(markdownContent);
        saveTimeoutRef.current = null;
      }, 2000); // Auto-save after 2 seconds of inactivity
    }

    // Cleanup function
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
    };
  }, [markdownContent, saveToDatabase, isLoading, isGenerating, reportId]);

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

  if (isGenerating) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <AppHeader
          currentPage="dashboard"
          onNavigate={handleNavigate}
          onLogout={handleLogout}
          pageTitle="Generating Report..."
        />
        <div className="container mx-auto px-4 py-8">
          <GeneratingReportCard
            status={generationStatus}
            reasoning={generationReasoning}
          />
        </div>
      </div>
    );
  }

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
        projectId={projectId}
        reportId={reportId || undefined}
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
        initialReviewNotes={generationReasoning}
        useTiptap={true}
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
