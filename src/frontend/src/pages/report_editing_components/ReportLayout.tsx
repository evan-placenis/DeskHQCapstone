import { useState, useEffect, useRef, useCallback } from "react";
import { AIChatSidebar, EditSuggestion } from "./AIChatSidebar";
import { ReportContent } from "./ReportContent";
import { PeerReview, ReportContent as ReportContentType } from "@/frontend/types";
import { DiffPopup } from "../smart_components/DiffPopup";

interface SelectedContext {
  type: "photo" | "section" | "text";
  content: string;
  id?: number | string;
  label: string;
  highlightedText?: string;
}

interface PendingChange {
  messageId: number | string; // Updated to allow string IDs
  sectionId?: number | string;
  field?: string;
  oldValue: string;
  newValue: string;
  newData?: any;
  changes?: any[];
  stats?: any;
  source: "ai" | "peer-review";
}

interface ReportLayoutProps {
  mode: "edit" | "peer-review";
  projectId?: string | number;
  reportId?: string | number;
  reportContent: ReportContentType;
  /** Current full document content (e.g. markdown) for AI edit replace; used when accepting edits */
  currentDocumentContent?: string;
  onContentChange: (updates: Partial<ReportContentType>) => void;
  onSectionChange: (sectionId: number | string, newContent: string, newData?: any) => void;
  /** Called after report content is saved (e.g. so parent can sync lastSavedContentRef) */
  onReportContentSaved?: (content: string) => void;

  // Header props
  onBack: () => void;
  backLabel?: string;

  // Photos
  photos?: Array<{ id: number | string; url: string; caption?: string; section?: string }>;

  // Status
  reportStatus: string;
  onStatusChange: (status: string) => void;

  // Actions
  onRequestPeerReview?: () => void;
  onExport?: () => void;
  onSave?: () => void;
  showSaveButton?: boolean;

  // Peer Review (only for peer-review mode)
  peerReview?: PeerReview;
  onAddReviewComment?: (comment: string, type: "issue" | "suggestion" | "comment") => void;
  onAddHighlightComment?: (highlightedText: string, sectionId: number | string, comment: string, type: "issue" | "suggestion" | "comment") => void;
  onResolveComment?: (commentId: number) => void;
  onCompleteReview?: () => void;
  onOpenRatingModal?: () => void;
  initialReviewNotes?: string;

  // 🟢 NEW: Use Tiptap for content rendering
  useTiptap?: boolean;
}

export function ReportLayout({
  mode,
  projectId,
  reportId,
  reportContent,
  currentDocumentContent,
  onContentChange,
  onSectionChange,
  onReportContentSaved,
  onBack,
  backLabel = "Back",
  photos = [],
  reportStatus,
  onStatusChange,
  onRequestPeerReview,
  onExport,
  onSave,
  showSaveButton = false,
  peerReview,
  onAddReviewComment,
  onAddHighlightComment,
  onResolveComment,
  onCompleteReview,
  onOpenRatingModal,
  initialReviewNotes,
  useTiptap = false,
}: ReportLayoutProps) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [initialChatMessages, setInitialChatMessages] = useState<Array<{ role: string; content: string; messageId?: string }>>([]);
  const [pendingChange, setPendingChange] = useState<PendingChange | null>(null);
  const [diffContent, setDiffContent] = useState<string | null>(null); // For inline diff in TiptapEditor
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedContexts, setSelectedContexts] = useState<SelectedContext[]>([]);

  // Get active section ID for context
  const activeSection = selectedContexts.find(c => c.type === "section");
  const activeSectionId = activeSection ? String(activeSection.id) : undefined;

  // Chat sidebar state - passed to AIChatSidebar component
  const [isChatCollapsed, setIsChatCollapsed] = useState(false);
  const [chatWidth, setChatWidth] = useState(384); // Default 384px (w-96)
  const [activeHighlightCommentId, setActiveHighlightCommentId] = useState<number | null>(null);

  // New: EditSuggestion state for diff popup
  const [pendingEditSuggestion, setPendingEditSuggestion] = useState<EditSuggestion | null>(null);
  const [isGeneratingEdit, setIsGeneratingEdit] = useState(false);
  
  // Debounced save ref
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Non-streaming AI edit function
  const requestAIEdit = useCallback(async (sectionRowId: string, instruction: string) => {
    if (!reportId || isGeneratingEdit) return;
    
    setIsGeneratingEdit(true);
    try {
      const response = await fetch(`/api/report/${reportId}/ai-edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sectionRowId, instruction })
      });
      
      if (!response.ok) {
        const error = await response.json();
        console.error('AI Edit failed:', error);
        return null;
      }
      
      const result = await response.json();
      if (result.status === 'SUCCESS' && result.suggestion) {
        setPendingEditSuggestion(result.suggestion);
        return result.suggestion;
      }
    } catch (error) {
      console.error('AI Edit request failed:', error);
    } finally {
      setIsGeneratingEdit(false);
    }
    return null;
  }, [reportId, isGeneratingEdit]);
  
  // Debounced save function for tiptap_content changes
  const debouncedSave = useCallback((newContent: string) => {
    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    // Set new debounced save (2 seconds)
    saveTimeoutRef.current = setTimeout(async () => {
      if (reportId && newContent) {
        try {
          // Save the updated tiptap_content to the database
          await fetch(`/api/report/${reportId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tiptap_content: newContent })
          });
          console.log('✅ Report content saved (debounced)');
        } catch (error) {
          console.error('❌ Failed to save report content:', error);
        }
      }
    }, 2000);
  }, [reportId]);
  
  // Cleanup debounce timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);
  
  // Handler for accepting an edit suggestion.
  // Display is always from tiptap_content. Section API replaces the substring in tiptap_content and updates report_sections; we use only the returned tiptap_content.
  const handleAcceptEditSuggestion = useCallback(async () => {
    if (!pendingEditSuggestion) return;

    const { sectionRowId, originalText, suggestedText } = pendingEditSuggestion;

    if (!reportId || !sectionRowId) {
      setPendingEditSuggestion(null);
      return;
    }

    try {
      const response = await fetch(`/api/report/${reportId}/section/${sectionRowId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: suggestedText,
          original_in_tiptap: originalText
        })
      });

      if (!response.ok) {
        console.error('Failed to update section:', await response.text());
        setPendingEditSuggestion(null);
        return;
      }

      const data = await response.json().catch(() => ({}));
      const newTiptapContent = data.tiptap_content;

      if (typeof newTiptapContent === 'string') {
        onContentChange({ tiptapContent: newTiptapContent });
        onReportContentSaved?.(newTiptapContent);
        console.log('✅ Section and tiptap_content updated');
      }
    } catch (error) {
      console.error('Error updating section:', error);
    }

    setPendingEditSuggestion(null);
  }, [pendingEditSuggestion, onContentChange, reportId, onReportContentSaved]);
  
  // Handler for rejecting (or dismissing) an edit suggestion. Only clears the popup.
  // AIChatSidebar keeps processedEditRef set so the same assistant message won't re-trigger
  // the edit request and re-prompt the user.
  const handleRejectEditSuggestion = useCallback(() => {
    setPendingEditSuggestion(null);
  }, []);

  // Auto-scroll is handled by Thread component

  // Ensure session exists before using useChat
  useEffect(() => {
    const ensureSession = async () => {
      if (!sessionId && projectId) {
        try {
          // STEP 1: Get or Create the Session ID
          // We use a simplified call or the existing POST to get the ID
          const res = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ projectId, reportId, message: null })
          });

          let newSessionId = null;
          if (res.ok) {
            const data = await res.json();
            newSessionId = data.sessionId || data.session?.sessionId || data.id;
            setSessionId(newSessionId);
            if (Array.isArray(data.messages) && data.messages.length > 0) {
              setInitialChatMessages(data.messages.map((m: { role?: string; content?: string; messageId?: string }) => ({
                role: m.role ?? "user",
                content: m.content ?? "",
                messageId: m.messageId
              })));
            }
          } else {
            const errBody = await res.json().catch(() => ({}));
            const errMsg = (errBody as { error?: string })?.error ?? res.statusText;
            console.error("ensureSession: POST /api/chat failed", res.status, errMsg);
          }
  
          // STEP 2: Fetch the History using GET /api/chat/sessions/[sessionId]
          // This ensures we get the correctly formatted 'user'/'assistant' array
          if (newSessionId) {
            const historyRes = await fetch(`/api/chat/sessions/${newSessionId}/stream`);
            if (historyRes.ok) {
              const historyMessages = await historyRes.json();
              if (Array.isArray(historyMessages) && historyMessages.length > 0) {
                setInitialChatMessages(historyMessages.map((m: { id?: string; role?: string; content?: string }) => ({
                  role: m.role ?? "user",
                  content: m.content ?? "",
                  messageId: m.id
                })));
              }
            }
          }
        } catch (error) {
          console.error("ensureSession error:", error);
        }
      }
    };
    ensureSession();
  }, [sessionId, projectId, reportId]);

  // Selection mode handlers (shared between ReportContent and AIChatSidebar)
  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    if (isSelectionMode) {
      // Exiting selection mode - clear all selections
      setSelectedContexts([]);
    }
  };

  const handleItemClick = (context: SelectedContext) => {
    if (!isSelectionMode) return;

    // Check if already selected
    const existingIndex = selectedContexts.findIndex(
      (c) => c.type === context.type && c.id === context.id
    );

    if (existingIndex >= 0) {
      // Remove if already selected
      setSelectedContexts(selectedContexts.filter((_, i) => i !== existingIndex));
    } else {
      // Add to selections
      setSelectedContexts([...selectedContexts, context]);
    }
  };

  const isItemSelected = (type: string, id?: number | string) => {
    return selectedContexts.some(
      (c) => c.type === type && c.id === id
    );
  };

  const removeSelectedContext = (index: number) => {
    setSelectedContexts(selectedContexts.filter((_, i) => i !== index));
  };

  const handleTextSelection = (text: string, sectionId: number | string | undefined, sectionTitle: string) => {
    if (!isSelectionMode) return;

    const selectedText = text.trim();

    if (selectedText && selectedText.length > 0) {
      const context: SelectedContext = {
        type: "text",
        id: sectionId,
        content: selectedText,
        label: `"${selectedText.substring(0, 30)}${selectedText.length > 30 ? '...' : ''}" from ${sectionTitle}`,
        highlightedText: selectedText
      };

      // Check if already selected
      const exists = selectedContexts.some(
        (c) => c.type === "text" && c.highlightedText === selectedText && c.id === sectionId
      );

      if (!exists) {
        setSelectedContexts([...selectedContexts, context]);
      }
    }
  };

  return (
    <div className="flex h-[calc(100vh-73px)] overflow-hidden">
      {/* Report Content */}
      <ReportContent
        mode={mode}
        reportContent={reportContent}
        onContentChange={onContentChange}
        onSectionChange={onSectionChange}
        onBack={onBack}
        backLabel={backLabel}
        reportStatus={reportStatus}
        onStatusChange={onStatusChange}
        onRequestPeerReview={onRequestPeerReview}
        onExport={onExport}
        onSave={onSave}
        showSaveButton={showSaveButton}
        peerReview={peerReview}
        onAddReviewComment={onAddReviewComment}
        onAddHighlightComment={onAddHighlightComment}
        onResolveComment={onResolveComment}
        onCompleteReview={onCompleteReview}
        onOpenRatingModal={onOpenRatingModal}
        initialReviewNotes={initialReviewNotes}
        useTiptap={useTiptap}
        isSelectionMode={isSelectionMode}
        onToggleSelectionMode={toggleSelectionMode}
        onItemClick={handleItemClick}
        isItemSelected={isItemSelected}
        onTextSelection={handleTextSelection}
        sessionId={sessionId}
        isChatCollapsed={isChatCollapsed}
        pendingChange={pendingChange}
        onSetPendingChange={setPendingChange}
        diffContent={diffContent}
        onSetDiffContent={setDiffContent}
      />

      {/* AI Chat Sidebar - Extracted to AIChatSidebar component */}
      <AIChatSidebar
        projectId={projectId != null ? String(projectId) : undefined}
        reportId={reportId != null ? String(reportId) : undefined}
        sessionId={sessionId}
        initialMessages={initialChatMessages}
        activeSectionId={activeSectionId ? String(activeSectionId) : undefined}
        isCollapsed={isChatCollapsed}
        width={chatWidth}
        onToggleCollapse={() => setIsChatCollapsed(!isChatCollapsed)}
        onResize={setChatWidth}
        onSuggestionAccept={(suggestion) => {
          // Handle the logic to update Tiptap or setPendingChange
          if (useTiptap && suggestion.sectionId === "main-content") {
            setDiffContent(suggestion.newValue);
          } else {
            setPendingChange({
              messageId: suggestion.messageId,
              sectionId: suggestion.sectionId,
              oldValue: suggestion.oldValue,
              newValue: suggestion.newValue,
              newData: undefined,
              source: suggestion.source as "ai" | "peer-review"
            });
          }
        }}
        onEditSuggestion={setPendingEditSuggestion}
        onRequestAIEdit={requestAIEdit}
        isGeneratingEdit={isGeneratingEdit}
        selectedContexts={selectedContexts.filter(c => c.type === "section" || c.type === "photo") as any}
        onClearSelectedContexts={() => setSelectedContexts([])}
        onRemoveSelectedContext={removeSelectedContext}
        isSelectionMode={isSelectionMode}
        onToggleSelectionMode={toggleSelectionMode}
        useTiptap={useTiptap}
        onSetDiffContent={setDiffContent}
      />

      {/* Diff Popup for AI edit suggestions */}
      {pendingEditSuggestion && (
        <DiffPopup
          suggestion={pendingEditSuggestion}
          onAccept={handleAcceptEditSuggestion}
          onReject={handleRejectEditSuggestion}
          onDismiss={handleRejectEditSuggestion}
        />
      )}
    </div>
  );
}
