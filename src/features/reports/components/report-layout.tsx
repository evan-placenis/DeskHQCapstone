import { useState, useEffect, useRef, useCallback } from "react";
import { AIChatSidebar, EditSuggestion } from "@/features/chat/components/ai-chat-sidebar";
import { ReportContent } from "./report-content";
import { PeerReview, ReportContent as ReportContentType } from "@/lib/types";
import type { TiptapEditorHandle, SelectionContext } from "./tiptap-editor";
import { stripLeadingHeading } from "./inline-diff-utils";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRoutes } from "@/lib/api-routes";

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
  /** Lightweight handler for TiptapEditor keystroke updates — ref + debounced save only, no state cascade */
  onEditorUpdate?: (newContent: string) => void;
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
  onAddReviewComment?: (comment: string, type: "issue" | "suggestion" | "comment") => void | Promise<void>;
  onAddHighlightComment?: (
    highlightedText: string,
    sectionId: number | string,
    comment: string,
    type: "issue" | "suggestion" | "comment"
  ) => void | Promise<void | { id: string | number } | null>;
  onResolveComment?: (commentId: number | string) => void | Promise<void>;
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
  onEditorUpdate,
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
  const [activeHighlightCommentId, setActiveHighlightCommentId] = useState<number | string | null>(null);

  const [isGeneratingEdit, setIsGeneratingEdit] = useState(false);
  // Range of the inline diff currently applied to the editor
  const [inlineDiffRange, setInlineDiffRange] = useState<{ from: number; to: number } | null>(null);
  // Doc-level unresolved edits (from editor scan; responds to Undo) — used for bottom Accept/Reject banner
  const [hasUnresolvedEdits, setHasUnresolvedEdits] = useState(false);
  const [appliedPeerSuggestionIds, setAppliedPeerSuggestionIds] = useState<Set<string>>(
    () => new Set(),
  );

  // Ref to Tiptap editor for client-context (selection + surrounding) AI edit
  const editorRef = useRef<TiptapEditorHandle | null>(null);
  // Pinned selection: survives blur so user can highlight in editor then type in chat (Cursor-style)
  const [pinnedSelectionContext, setPinnedSelectionContext] = useState<SelectionContext | null>(null);

  // Fetch Map & Lens from the live editor at send time — no state, no cursor listeners
  const getEditorContext = useCallback(() => {
    if (editorRef.current) {
      const outline = editorRef.current.getDocumentOutlineString();
      const section = editorRef.current.getActiveSection();
      const full = editorRef.current.getFullMarkdown();
      return {
        documentOutline: outline,
        activeSectionMarkdown: section?.markdown ?? '',
        activeSectionHeading: section?.heading ?? '',
        fullReportMarkdown: full,
      };
    }
    // Fallback when editor not mounted (e.g. non-Tiptap mode)
    const main = reportContent.sections.find(s => s.id === 'main-content');
    return {
      documentOutline: '',
      activeSectionMarkdown: '',
      activeSectionHeading: '',
      fullReportMarkdown: main?.content ?? '',
    };
  }, [reportContent]);

  // Refresh pinned selection only (for selection-edit flow)
  const handleSelectionChange = useCallback((ctx: SelectionContext | null) => {
    setPinnedSelectionContext(ctx);
  }, []);

  // Wrap parent's onEditorUpdate — no Map/Lens state to update
  const handleEditorUpdateWithContext = useCallback((newContent: string) => {
    onEditorUpdate?.(newContent);
  }, [onEditorUpdate]);

  // Selection-based AI edit: stream the AI response silently, then inject the inline diff
  // directly into the Tiptap editor. No modal popup — the user reviews green/red marks in place.
  const requestAIEditWithSelection = useCallback(
    async (context: SelectionContext, instruction: string) => {
      if (!reportId || isGeneratingEdit) return;

      const editRange = context.range;
      setPinnedSelectionContext(null);
      editorRef.current?.clearSelection();
      setIsGeneratingEdit(true);
      try {
        const response = await fetch(apiRoutes.report.aiEdit(reportId), {
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

        // Drain the stream silently — the loading spinner covers the wait.
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let suggestedText = "";
        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            suggestedText += decoder.decode(value, { stream: true });
          }
        }

        suggestedText = suggestedText.trim();
        if (suggestedText && editorRef.current) {
          const newRange = editorRef.current.applyLibraryDiff(editRange, suggestedText);
          setInlineDiffRange(newRange);
        }
      } catch (error) {
        console.error("AI Edit (selection) request failed:", error);
      } finally {
        setIsGeneratingEdit(false);
      }
    },
    [reportId, isGeneratingEdit]
  );
  
  const handleAcceptAllChanges = useCallback(() => {
    if (!editorRef.current) return;
    editorRef.current.resolveAllChanges('accept');
    setInlineDiffRange(null);
  }, []);

  const handleRejectAllChanges = useCallback(() => {
    if (!editorRef.current) return;
    editorRef.current.resolveAllChanges('reject');
    setInlineDiffRange(null);
  }, []);

  // Handles propose_structure_insertion tool calls: replace_section uses
  // applyLibraryDiff for inline diff; insert anchors use insertAtPosition.
  /** Direct markdown replace (no inline diff UI); uses editor history so Ctrl+Z can undo. */
  const handleApplyPeerSuggestion = useCallback(
    (commentId: number | string) => {
      if (inlineDiffRange || hasUnresolvedEdits) {
        alert(
          "Please accept or undo the pending AI edits in the document before applying another suggestion.",
        );
        return;
      }
      const c = peerReview?.comments?.find((x) => String(x.id) === String(commentId));
      if (!c || c.type !== "suggestion" || !c.highlightedText?.trim() || !c.comment?.trim()) return;
      if (String(c.sectionId ?? "main-content") !== "main-content") {
        alert("Applying suggestions is only supported in the main report body.");
        return;
      }
      if (!editorRef.current) return;
      const range = editorRef.current.findRangeForPlainText(c.highlightedText);
      if (!range) {
        alert("Could not find the highlighted text in the document.");
        return;
      }
      const body = stripLeadingHeading(c.comment.trim());
      editorRef.current.replaceRange(range, body);
      setAppliedPeerSuggestionIds((prev) => new Set(prev).add(String(commentId)));
    },
    [peerReview, inlineDiffRange, hasUnresolvedEdits],
  );

  const handleAppliedPeerSuggestionIdsChange = useCallback((next: Set<string>) => {
    setAppliedPeerSuggestionIds(next);
  }, []);

  const handleEditSuggestion = useCallback((suggestion: EditSuggestion) => {
    if (!editorRef.current) return;
    const { suggestedText, originalText, insertAnchor } = suggestion;
    if (!insertAnchor) return;

    const replaceSection =
      typeof insertAnchor === 'object' && 'replaceSection' in insertAnchor
        ? insertAnchor.replaceSection
        : null;

    if (replaceSection) {
      const range = editorRef.current.getRangeForReplaceSection(replaceSection);
      if (!range) {
        console.warn("handleEditSuggestion: could not resolve section:", replaceSection);
        return;
      }

      // Strip any leading heading the AI echoed back (the heading is already
      // in the editor; re-inserting it would double it or clobber the heading node).
      const bodyContent = stripLeadingHeading(suggestedText);

      const newRange = editorRef.current.applyLibraryDiff(range, bodyContent);
      setInlineDiffRange(newRange);
    } else {
      const pos = editorRef.current.getInsertPositionForAnchor(insertAnchor);
      if (pos != null) {
        const content = (pos > 0 && !suggestedText.startsWith('\n') ? '\n\n' : '') + suggestedText;
        editorRef.current.insertAtPosition(pos, content);
      } else {
        console.warn("handleEditSuggestion: could not resolve insert anchor:", insertAnchor);
      }
    }
  }, []);

  // Auto-scroll is handled by Thread component

  // Ensure session exists before using useChat
  useEffect(() => {
    const ensureSession = async () => {
      if (!sessionId && projectId) {
        try {
          // STEP 1: Get or Create the Session ID
          // We use a simplified call or the existing POST to get the ID
          const res = await fetch(apiRoutes.chat.root, {
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
              setInitialChatMessages(data.messages.map((m: { role?: string; sender?: string; content?: string; messageId?: string }) => ({
                // ChatSession returns messages with 'sender' field, not 'role'
                role: m.sender ?? m.role ?? "user",
                content: m.content ?? "",
                messageId: m.messageId
              })));
            }
          } else {
            const errBody = await res.json().catch(() => ({}));
            const errMsg = (errBody as { error?: string })?.error ?? res.statusText;
            console.error("ensureSession: POST /api/chat failed", res.status, errMsg);
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
        onEditorUpdate={handleEditorUpdateWithContext}
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
        onSelectionChange={handleSelectionChange}
        pinnedSelectionRange={pinnedSelectionContext?.range ?? null}
        onAllDiffChangesResolved={() => setInlineDiffRange(null)}
        onHasUnresolvedEditsChange={setHasUnresolvedEdits}
        onApplyPeerSuggestion={handleApplyPeerSuggestion}
        appliedPeerSuggestionIds={appliedPeerSuggestionIds}
        onAppliedPeerSuggestionIdsChange={handleAppliedPeerSuggestionIdsChange}
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
        onEditSuggestion={handleEditSuggestion}
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
        getEditorContext={getEditorContext}
      />

      {/* Accept/reject banner — appears when inline diff exists or doc has unresolved edits (e.g. after Undo). */}
      {(inlineDiffRange || hasUnresolvedEdits) && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-3 shadow-2xl"
          role="status"
          aria-live="polite"
        >
          <span className="text-sm font-medium text-slate-700">
            AI changes applied — 
          </span>
          <Button
            size="sm"
            onClick={handleAcceptAllChanges}
            className="h-8 bg-green-600 text-xs text-white hover:bg-green-700"
          >
            <Check className="mr-1.5 h-3 w-3" />
            Keep All Changes
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRejectAllChanges}
            className="h-8 text-xs hover:border-red-300 hover:bg-red-50 hover:text-red-700"
          >
            <X className="mr-1.5 h-3 w-3" />
            Undo
          </Button>
          
        </div>
      )}
    </div>
  );
}
