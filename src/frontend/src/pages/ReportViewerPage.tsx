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
import { supabase } from "@/frontend/lib/supabaseClient"; 
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/frontend/pages/ui_components/card";

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

  const currentUserId = 2;
  // Use String comparison for IDs
  const assignedReview = peerReviews.find(r => String(r.reportId) === reportId && r.assignedToId === currentUserId);

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
            
            if (data.projectId) {
                setProjectId(data.projectId);
                setProjectName("Project");
            }

            setReportContent({
                title: data.title || "Untitled Report",
                date: new Date(data.updatedAt).toLocaleDateString(),
                location: "Project Site", 
                engineer: "AI Assistant",
                sections: (data.reportContent || data.sections || []).map((s: any) => {
                    
                    // 🟢 Robust Recursive Processing
                    const processNode = (node: any, depth: number): { text: string, images: any[] } => {
                        let text = "";
                        let images = [...(node.images || [])];
                        
                        // 1. Handle Title (Subsections)
                        // Depth 0 is Main Section (handled by outer map)
                        // Depth 1 is Subsection (###)
                        if (depth === 1 && node.title && node.title !== "General Summary" && node.title !== "Observed Conditions") {
                            text += `### ${node.title}\n\n`;
                        }

                        // 2. Handle Description / Content
                        if (node.description) {
                            text += `${node.description}\n\n`;
                        } else if (node.content) {
                            text += `${node.content}\n\n`;
                        }

                        // 3. Handle Bullet Point
                        if (node.point) {
                            text += `- ${node.point}\n`; 
                        }

                        // 4. Recurse Children
                        if (node.children && Array.isArray(node.children)) {
                            const childResults = node.children.map((child: any) => processNode(child, depth + 1));
                            
                            // Combine texts
                            const childrenText = childResults.map((r: any) => r.text).join(""); // Bullets need tight packing, but subsections need spacing
                            
                            // If children are bullet points, we don't need extra spacing
                            // If children are subsections, we might want spacing
                            // Simple heuristic: Join with nothing, as children add their own trailing newlines
                            text += childrenText;

                            // Combine images
                            childResults.forEach((r: any) => images.push(...r.images));
                        }

                        return { text, images };
                    };

                    // 🟢 Reconstruct Markdown Content from Nested Structure if needed
                    let content = s.description || s.content || "";
                    let aggregatedImages = [...(s.images || [])];

                    if (s.children && Array.isArray(s.children)) {
                         const results = s.children.map((child: any) => processNode(child, 1));
                         content += (content ? "\n\n" : "") + results.map((r: any) => r.text).join("\n"); // Add spacing between subsections
                         results.forEach((r: any) => aggregatedImages.push(...r.images));
                    }

                    // Deduplicate aggregated images
                    const uniqueImages: any[] = [];
                    const seenIds = new Set();
                    aggregatedImages.forEach(img => {
                        const id = typeof img === 'string' ? img : (img.imageId || img.id);
                        if (id && !seenIds.has(id)) {
                            seenIds.add(id);
                            uniqueImages.push(img);
                        } else if (!id) {
                             uniqueImages.push(img);
                        }
                    });

                    return {
                        id: s.id || Math.random().toString(),
                        title: s.sectionTitle || s.title || "Untitled Section",
                        description: s.description, // 🟢 Pass raw parent description
                        content: content.trim(),
                        images: uniqueImages, 
                        subSections: s.children 
                    };
                })
            });
            setReportStatus(data.status || "Draft");
        })
        .catch(err => console.error("Error fetching report:", err))
        .finally(() => setIsLoading(false));
    }
  }, [reportId]);

  // 🟢 NEW: Supabase Realtime Subscription for Report Generation
  useEffect(() => {
      if (!isGenerating || !projectIdParam) return;

      console.log(`🔌 Subscribing to channel: project-${projectIdParam}`);

      const channel = supabase.channel(`project-${projectIdParam}`)
          .on('broadcast', { event: 'status' }, (payload) => {
              setGenerationStatus(payload.payload.chunk);
          })
          .on('broadcast', { event: 'reasoning' }, (payload) => {
              setGenerationReasoning(prev => prev + payload.payload.chunk);
          })
          .on('broadcast', { event: 'review_reasoning' }, (payload) => {
               setGenerationReasoning(prev => prev + payload.payload.chunk);
          })
          .on('broadcast', { event: 'report_complete' }, (payload) => {
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
        initialReviewNotes={generationReasoning} // 🟢 Pass the reasoning
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
