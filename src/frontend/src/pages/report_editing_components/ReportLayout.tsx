import { useState, useEffect, useRef, useCallback } from "react";
import { AIChatSidebar, EditSuggestion } from "./AIChatSidebar";
import { ReportContent } from "./ReportContent";
import { PeerReview, ReportContent as ReportContentType } from "@/frontend/types";
import { DiffPopup } from "../smart_components/DiffPopup";
import type { TiptapEditorHandle, SelectionContext } from "../smart_components/TiptapEditor";
import { Loader2 } from "lucide-react";

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

  //TODO: don't think we need this anymore
  // Get active section ID for context
  const activeSection = selectedContexts.find(c => c.type === "section");
  const activeSectionId = activeSection ? String(activeSection.id) : undefined;

  // Chat sidebar state - passed to AIChatSidebar component
  const [isChatCollapsed, setIsChatCollapsed] = useState(false);
  const [chatWidth, setChatWidth] = useState(384); // Default 384px (w-96)
  const [activeHighlightCommentId, setActiveHighlightCommentId] = useState<number | null>(null);

  // EditSuggestion state for diff popup
  const [pendingEditSuggestion, setPendingEditSuggestion] = useState<EditSuggestion | null>(null);
  const [isGeneratingEdit, setIsGeneratingEdit] = useState(false);

  // Ref to Tiptap editor for client-context (selection + surrounding) AI edit
  const editorRef = useRef<TiptapEditorHandle | null>(null);
  // Pinned selection: survives blur so user can highlight in editor then type in chat (Cursor-style)
  const [pinnedSelectionContext, setPinnedSelectionContext] = useState<SelectionContext | null>(null);

  // Debounced save ref
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Selection-based AI edit: send markdown to API, store range, apply via editor.replaceRange on accept
  const requestAIEditWithSelection = useCallback(
    async (context: SelectionContext, instruction: string) => {
      if (!reportId || isGeneratingEdit) return;

      const editRange = context.range;
      setPinnedSelectionContext(null);
      editorRef.current?.clearSelection();
      setIsGeneratingEdit(true);
      try {
        const response = await fetch(`/api/report/${reportId}/ai-edit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            selection: context.markdown,
            surroundingContext: context.surroundingContext ?? "",
            instruction,
          }),
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          console.error("AI Edit (selection) failed:", err);
          return;
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let suggestedText = "";
        let lastUpdate = 0;
        const UPDATE_INTERVAL_MS = 80;
        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            suggestedText += decoder.decode(value, { stream: true });
            const now = Date.now();
            const isFirstChunk = suggestedText.length > 0 && lastUpdate === 0;
            if (isFirstChunk || now - lastUpdate >= UPDATE_INTERVAL_MS) {
              lastUpdate = now;
              setPendingEditSuggestion((prev) => {
                const base =
                  prev ??
                  ({
                    originalText: context.selection,
                    suggestedText: "",
                    reason: instruction,
                    status: "PENDING",
                    range: editRange,
                  } as EditSuggestion);
                return { ...base, suggestedText };
              });
            }
          }
        }
        suggestedText = suggestedText.trim();
        if (suggestedText) {
          setPendingEditSuggestion((prev) =>
            prev ? { ...prev, suggestedText } : null
          );
        } else {
          setPendingEditSuggestion(null);
        }
      } catch (error) {
        console.error("AI Edit (selection) request failed:", error);
      } finally {
        setIsGeneratingEdit(false);
      }
    },
    [reportId, isGeneratingEdit]
  );
  
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
  
  // Accept edit: range-based replace in Tiptap (markdown in/out); editor onUpdate triggers save path.
  const handleAcceptEditSuggestion = useCallback(() => {
    if (!pendingEditSuggestion) return;

    const { suggestedText, range } = pendingEditSuggestion;

    if (useTiptap && editorRef.current && range != null) {
      editorRef.current.replaceRange(range, suggestedText);
      console.log("✅ Edit accepted via Tiptap replaceRange (save will sync via onUpdate)");
    } else if (pendingEditSuggestion.fullDocument != null) {
      // Legacy fallback: string replace when not using Tiptap or no range
      const { originalText, fullDocument } = pendingEditSuggestion;
      let newContent = fullDocument.replace(originalText, suggestedText);
      if (newContent === fullDocument) {
        const trimmed = originalText.trim();
        if (trimmed && fullDocument.includes(trimmed)) {
          newContent = fullDocument.replace(trimmed, suggestedText);
        }
      }
      if (newContent !== fullDocument) {
        onContentChange({ tiptapContent: newContent });
      }
    }

    setPendingEditSuggestion(null);
  }, [pendingEditSuggestion, useTiptap, onContentChange]);
  
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
        editorRef={editorRef}
        onSelectionChange={setPinnedSelectionContext}
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
        getEditorSelectionContext={() => editorRef.current?.getSelectionContext() ?? pinnedSelectionContext ?? null}
        onRequestAIEditWithSelection={requestAIEditWithSelection}
        pinnedSelectionContext={pinnedSelectionContext}
        onClearPinnedSelection={() => setPinnedSelectionContext(null)}
        isGeneratingEdit={isGeneratingEdit}
        selectedContexts={selectedContexts.filter(c => c.type === "section" || c.type === "photo") as any}
        onClearSelectedContexts={() => setSelectedContexts([])}
        onRemoveSelectedContext={removeSelectedContext}
        isSelectionMode={isSelectionMode}
        onToggleSelectionMode={toggleSelectionMode}
        useTiptap={useTiptap}
        onSetDiffContent={setDiffContent}
      />

      {/* Loading overlay: show as soon as user sends a selection edit, until the suggestion is ready.
          Backend delay causes to check if popup stays slow: (1) generateText waits for full response vs streamText,
          (2) edit orchestrator stepCountIs(5) allows many tool rounds, (3) edit skills include research tools so model may call search first,
          (4) model/provider latency. Consider streaming + stepCountIs(2) and showing popup on first chunk. */}
      {isGeneratingEdit && !pendingEditSuggestion && useTiptap && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" aria-hidden />
          <div
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white rounded-lg shadow-2xl border border-slate-200 px-8 py-6 flex flex-col items-center gap-4 min-w-[280px]"
            role="status"
            aria-live="polite"
          >
            <Loader2 className="w-10 h-10 animate-spin text-theme-primary" />
            <p className="text-sm font-medium text-slate-700">Generating your edit...</p>
            <p className="text-xs text-slate-500">This usually takes a few seconds</p>
          </div>
        </>
      )}

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
