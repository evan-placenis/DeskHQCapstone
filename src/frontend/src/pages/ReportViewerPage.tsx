"use client";

import { useState, Suspense, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppHeader } from "@/frontend/pages/smart_components/AppHeader";
import { Page } from "@/app/pages/config/routes";
import { Project, PeerReview, ReportContent, Photo } from "@/frontend/types";
import { RequestPeerReviewModal } from "@/frontend/pages/large_modal_components/RequestPeerReviewModal";
import { RatingModal } from "@/frontend/pages/large_modal_components/RatingModal";
import PlanApprovalModal from "@/frontend/pages/large_modal_components/PlanApprovalModal";
import { ReportLayout } from "@/src/frontend/src/pages/report_editing_components/ReportLayout";
import { ROUTES, getRoute } from "@/app/pages/config/routes";
import { supabase } from "@/frontend/lib/supabaseClient";
import { Loader2, FileText, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/frontend/pages/ui_components/card";
import { useReportStreaming } from "@/frontend/pages/hooks/useReportStreaming";

import { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// 1. CONSTANTS
const MARKDOWN_PLUGINS = [remarkGfm];

// 2. THE RENDERER (Memoized for performance)
const StreamRenderer = memo(({ content }: { content: string }) => (
  <div className="prose prose-sm max-w-none text-slate-700 leading-relaxed
    prose-p:my-2 prose-ul:my-2 prose-li:my-0 
    prose-headings:font-semibold prose-headings:text-slate-900 prose-headings:mt-4 prose-headings:mb-2
    prose-strong:text-slate-900 prose-strong:font-bold
    prose-pre:bg-slate-100 prose-pre:p-3 prose-pre:rounded-lg">

    <ReactMarkdown remarkPlugins={MARKDOWN_PLUGINS}>
      {content}
    </ReactMarkdown>

    {/* The "Ghost Cursor" Effect */}
    <span className="inline-block w-1.5 h-4 ml-1 bg-theme-primary animate-pulse align-middle translate-y-[2px]" />
  </div>
));

// 3. STATUS INDICATOR
const StatusFooter = memo(({ status }: { status: string }) => {
  if (!status || status === 'Idle') return null;

  return (
    <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-100 text-slate-400 animate-in fade-in">
      <Loader2 className="w-3.5 h-3.5 animate-spin text-theme-primary" />
      <span className="text-xs font-mono uppercase tracking-wider">{status}</span>
    </div>
  );
});

// 4. MAIN COMPONENT — "Disappearing Act": reasoning box only while generating, hides when isComplete
export const ReportLiveStream = ({
  reasoningText,
  status,
  isComplete
}: {
  reasoningText: string;
  status: string;
  isComplete?: boolean;
}) => {

  return (
    <div className="flex flex-col gap-4 max-w-4xl mx-auto mt-8">

      {/* 2. THINKING BOX — Only while generating; fades out when isComplete */}
      {!isComplete && (
        <Card className="border-2 border-theme-primary/10 shadow-lg bg-white overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="bg-slate-50/80 border-b border-slate-100 px-4 py-2 flex items-center gap-2">
            <FileText className="w-4 h-4 text-theme-primary animate-pulse" />
            <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wide">Agent is thinking...</h4>
          </div>
          <CardContent className="p-6 min-h-[200px] max-h-[60vh] overflow-y-auto scroll-smooth bg-white">
            {!reasoningText ? (
              <div className="flex flex-col items-center justify-center text-slate-400 gap-2 py-12">
                <Loader2 className="w-8 h-8 animate-spin opacity-50" />
                <p className="text-sm font-medium">Building Report ...</p>
              </div>
            ) : (
              <div className="prose prose-sm max-w-none text-slate-700">
                <StreamRenderer content={reasoningText} />
              </div>
            )}
          </CardContent>
          {status && status !== 'Initializing...' && (
            <div className="px-4 pb-3 pt-0">
              <StatusFooter status={status} />
            </div>
          )}
        </Card>
      )}

      {/* 3. SUCCESS STATE — Shown when isComplete (replaces thinking box) */}
      {isComplete && (
        <Card className="border-2 border-green-200 shadow-lg bg-white overflow-hidden animate-in fade-in duration-300">
          <CardContent className="p-6 flex flex-col items-center justify-center gap-4 min-h-[120px]">
            <div className="p-3 rounded-full bg-green-100 text-green-600">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-lg font-bold text-green-700">Report generated successfully!</h2>
            <p className="text-sm text-slate-500">Redirecting to report...</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};


// // 🟢 NEW: Component for showing generation progress
// const GeneratingReportCard = ({ status, reasoningText }: { status: string, reasoningText: string }) => (
//   <Card className="rounded-xl shadow-md border-2 border-theme-primary bg-blue-50/50 mb-6 animate-in fade-in slide-in-from-top-4 duration-500 mx-auto max-w-4xl mt-8">
//     <CardContent className="p-6">
//       <div className="flex flex-col gap-4">
//         <div className="flex items-center justify-between">
//           <div className="flex items-center gap-3">
//             <div className="relative">
//               <div className="absolute inset-0 bg-theme-primary/20 rounded-full animate-ping"></div>
//               <div className="relative w-10 h-10 bg-theme-primary/10 rounded-full flex items-center justify-center">
//                 <Loader2 className="w-5 h-5 text-theme-primary animate-spin" />
//               </div>
//             </div>
//             <div>
//               <h3 className="font-semibold text-slate-900">Generating Report</h3>
//               <p className="text-sm text-theme-primary font-medium">{status || "Initializing..."}</p>
//             </div>
//           </div>
//         </div>

//         {reasoningText && (
//           <div className="bg-white rounded-lg p-4 border border-slate-200 shadow-sm">
//             <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
//               <span className="w-1.5 h-1.5 rounded-full bg-theme-primary"></span>
//               AI Thinking Process
//             </div>
//             <p className="text-sm text-slate-700 font-mono whitespace-pre-wrap leading-relaxed max-h-[60vh] overflow-y-auto">
//               {reasoningText}
//               <span className="inline-block w-2 h-4 ml-1 bg-theme-primary animate-pulse align-middle"></span>
//             </p>
//           </div>
//         )}
//       </div>
//     </CardContent>
//   </Card>
// );



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
  
  // Use custom hook for streaming
  const { 
    reasoningText: generationReasoning, 
    status: generationStatus, 
    reportId: streamedReportId, 
    isComplete,
    isPaused,
    reportPlan 
  } = useReportStreaming(projectIdParam, isGenerating);


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
  
  // Human-in-the-Loop approval modal
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [polledReportPlan, setPolledReportPlan] = useState<any>(null);

  const currentUserId = 2;
  // Use String comparison for IDs
  const assignedReview = peerReviews.find(r => String(r.reportId) === reportId && r.assignedToId === currentUserId);

  // 🟢 NEW: Tiptap content state
  const [markdownContent, setMarkdownContent] = useState("");
  const lastSavedContentRef = useRef<string>(""); // Track what was last saved to prevent unnecessary saves
  // Ref for lightweight keystroke save path — avoids setState on every keypress
  const latestContentRef = useRef<string>("");
  const editorSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

          // Display only from tiptap_content; if empty, report is blank
          const tiptapContent = data.tiptap_content ?? "";
          setMarkdownContent(tiptapContent);
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
            }],
            tiptapContent: tiptapContent // Also set at top level for AI edit flow
          });
          setReportStatus(data.status || "Draft");
        })
        .catch(err => console.error("Error fetching report:", err))
        .finally(() => setIsLoading(false));
    }
  }, [reportId, isGenerating]);

  // Handle report completion from streaming hook
  useEffect(() => {
    if (isComplete && streamedReportId) {
      // Update URL without reloading page
      const newUrl = `/pages/report?id=${streamedReportId}`;
      window.history.replaceState({ ...window.history.state, as: newUrl, url: newUrl }, '', newUrl);
      
      setReportId(streamedReportId);
      setIsGenerating(false);
    }
  }, [isComplete, streamedReportId]);

  // 🔔 Handle plan approval request (Human-in-the-Loop)
  useEffect(() => {
    console.log('🔍 Modal check:', { isPaused, hasReportPlan: !!reportPlan, showApprovalModal });
    if (isPaused && reportPlan) {
      console.log('📋 Report plan ready for approval:', reportPlan);
      console.log('✅ Setting showApprovalModal to TRUE');
      setShowApprovalModal(true);
    }
  }, [isPaused, reportPlan]);

  // 🔄 BACKUP POLLING: Poll database for AWAITING_APPROVAL status
  // This is a fallback in case Realtime events don't fire
  useEffect(() => {
    // Use reportId from URL if available, otherwise wait for streamed reportId
    const pollingReportId = reportId && reportId !== '0' ? reportId : streamedReportId;
    
    if (!isGenerating || !pollingReportId) return;

    console.log(`🔄 Starting backup polling for report ${pollingReportId}`);

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/report/${pollingReportId}/status`);
        const result = await response.json();
        
        if (result.error) {
          console.error('Polling error:', result.error);
          return;
        }

        console.log(`📊 Poll result: status="${result.status}"`);

        // If status is AWAITING_APPROVAL, show the approval modal
        // Keep polling so we can detect when the builder finishes after approval
        if (result.status === 'AWAITING_APPROVAL' && result.plan && !showApprovalModal) {
          console.log('✅ Detected AWAITING_APPROVAL via polling!');
          setPolledReportPlan(result.plan);
          setShowApprovalModal(true);
        }

        // If status changed to DRAFT (builder finished) or COMPLETED/FINAL, stop generating
        // Note: initial status is 'GENERATING', so 'DRAFT' only appears after saveReport completes
        if (result.status === 'DRAFT' || result.status === 'COMPLETED' || result.status === 'FINAL') {
          console.log(`🎉 Report completed (detected via polling, status="${result.status}")`);
          setIsGenerating(false);
          clearInterval(pollInterval);
        }
      } catch (err) {
        console.error('Polling exception:', err);
      }
    }, 3000); // Poll every 3 seconds

    return () => {
      console.log('🛑 Stopping backup polling');
      clearInterval(pollInterval);
    };
  }, [isGenerating, reportId, streamedReportId, showApprovalModal]);

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
    setReportContent(prev => {
      const next = { ...prev, ...updates };
      // If tiptapContent was updated (e.g., from AI edit), also set main section content
      // so the TipTap editor re-renders with the new text
      if (updates.tiptapContent !== undefined && prev.sections?.length) {
        next.sections = prev.sections.map((s, i) =>
          s.id === "main-content" ? { ...s, content: updates.tiptapContent! } : s
        );
      }
      return next;
    });
    // Sync markdownContent (source of truth for editor display)
    if (updates.tiptapContent !== undefined) {
      setMarkdownContent(updates.tiptapContent);
    }
  };

  // 🟢 Handle section change — used for explicit/external updates (diff accept, AI edit, pending changes).
  // Updates React state so TiptapEditor picks up the new content via its content prop.
  const handleSectionChange = (sectionId: number | string, newContent: string, newData?: any) => {
    setMarkdownContent(newContent);
    latestContentRef.current = newContent;

    const updatedSections = reportContent.sections.map(s => {
      if (s.id === sectionId) {
        return { ...s, content: newContent, ...(newData || {}) };
      }
      return s;
    });
    handleContentChange({ sections: updatedSections });
  };

  // 2. Auto-Save Logic (Debounced) — called directly, not via useEffect
  const saveToDatabase = useCallback(async (newContent: string) => {
    if (!reportId) return;
    if (newContent === lastSavedContentRef.current) return;

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
      lastSavedContentRef.current = newContent;
    } catch (err) {
      console.error("Failed to save:", err);
    } finally {
      setIsSaving(false);
    }
  }, [reportId]);

  // 🟢 Lightweight handler for TiptapEditor's onUpdate (every keystroke).
  // Does NOT update React state — avoids the setState cascade + re-render on every keypress.
  // Only stores the latest content in a ref and schedules a debounced save.
  const handleEditorUpdate = useCallback((newContent: string) => {
    latestContentRef.current = newContent;

    // Schedule debounced save
    if (editorSaveTimeoutRef.current) {
      clearTimeout(editorSaveTimeoutRef.current);
    }
    editorSaveTimeoutRef.current = setTimeout(() => {
      saveToDatabase(newContent);
      editorSaveTimeoutRef.current = null;
    }, 2000);
  }, [saveToDatabase]);

  // Cleanup save timeout on unmount
  useEffect(() => {
    return () => {
      if (editorSaveTimeoutRef.current) {
        clearTimeout(editorSaveTimeoutRef.current);
      }
    };
  }, []);

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

  // 1. Add State for Photos
  const [photos, setPhotos] = useState<Photo[]>([]); // The actual image objects (url, id, etc.)
  // Fetch Report & Photos
  useEffect(() => {
    if (isGenerating && !reportId) return; // Wait if we don't have an ID yet

    const fetchReportData = async () => {
      if (!reportId || reportId === "0") return;
      
      setIsLoading(true);
      try {
        // ---------------------------------------------------------
      // 1. FAST PATH: Fetch Photos using Project ID from URL
      // ---------------------------------------------------------
      const targetProjectId = projectIdParam; // Grab directly from URL

      if (targetProjectId) {
        const { data: photosData, error: photosError } = await supabase
          .from('project_images') 
          .select('*')
          .eq('project_id', targetProjectId);

          if (photosData) {
            console.log("🔍 RAW PHOTO DATA SAMPLE:", photosData[0]); 
            // ^ Look at this object in the console. 
            // Does it have a 'url' property? Or is it 'file_path'?
         }

        if (photosError) {
          console.error("❌ Error fetching photos:", photosError);
        } else if (photosData) {
          console.log(`📸 Loaded ${photosData.length} photos for Project: ${targetProjectId}`);
          // 🛠️ COPY THE MAPPING LOGIC FROM ProjectDetailPage HERE:
          const cleanPhotos = photosData.map((img: any) => ({
            id: String(img.id),         // Ensure string ID
            url: img.public_url,        // 👈 KEY FIX: Map DB 'public_url' -> UI 'url'
            storagePath: img.storage_path, // Keep this for SecureImage
            name: img.file_name || "Image",
            date: img.created_at,
            // You can add other fields if needed, or leave them optional
            description: img.description || "",
            folderId: 0 // Default if you don't have folder logic here yet
        }));
          setPhotos(cleanPhotos); // <--- State updated! Modal will now work.
        }
      }

      } catch (err) {
        console.error("Error fetching report data:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchReportData();
  }, [reportId, isGenerating]);

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
          <ReportLiveStream
            reasoningText={generationReasoning}
            status={generationStatus}
            isComplete={isComplete}
          />
        </div>

        {/* Human-in-the-Loop Plan Approval Modal - Must be rendered during generation! */}
        <PlanApprovalModal
          open={showApprovalModal}
          onClose={() => setShowApprovalModal(false)}
          reportPlan={reportPlan || polledReportPlan}
          reportId={reportId && reportId !== '0' ? reportId : (streamedReportId || '')}
          onApprove={() => {
            console.log("✅ Plan approved, resuming generation");
            setShowApprovalModal(false);
            setPolledReportPlan(null);
            // Keep isGenerating true so we continue listening for streaming updates
          }}
          onReject={(feedback) => {
            console.log("🔄 Plan rejected with feedback:", feedback);
            setShowApprovalModal(false);
            setPolledReportPlan(null);
            // Keep isGenerating true so we continue listening for the revised plan
          }}
          photos={photos}
        />
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
        currentDocumentContent={markdownContent}
        onContentChange={handleContentChange}
        onSectionChange={handleSectionChange}
        onEditorUpdate={handleEditorUpdate}
        onReportContentSaved={ (content) => { lastSavedContentRef.current = content; } }
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

      {/* Human-in-the-Loop Plan Approval Modal */}
      {/* Use Realtime plan or fallback to polled plan */}
      <PlanApprovalModal
        open={showApprovalModal}
        onClose={() => setShowApprovalModal(false)}
        reportPlan={reportPlan || polledReportPlan}
        reportId={reportId && reportId !== '0' ? reportId : (streamedReportId || '')}
        onApprove={() => {
          console.log("✅ Plan approved, resuming generation");
          setShowApprovalModal(false);
          setPolledReportPlan(null); // Clear polled plan
          // Keep isGenerating true so we continue listening for streaming updates
        }}
        onReject={(feedback) => {
          console.log("🔄 Plan rejected with feedback:", feedback);
          setShowApprovalModal(false);
          setPolledReportPlan(null); // Clear polled plan
          // Keep isGenerating true so we continue listening for the revised plan
          
        }}
        photos={photos}
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
