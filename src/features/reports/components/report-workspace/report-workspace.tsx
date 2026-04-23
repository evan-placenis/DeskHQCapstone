"use client";

import { useState, useRef, useCallback } from "react";
import { AIChatSidebar, EditSuggestion } from "@/features/chat/components/ai-chat-sidebar";
import { ReportDocument, type PendingChange } from "./document";
import type { TiptapEditorHandle, SelectionContext } from "../authoring/tiptap/tiptap-editor";
import { stripLeadingHeading } from "../authoring/tiptap/diff/inline-diff-utils";
import { apiRoutes } from "@/lib/api-routes";
import { InlineDiffAcceptBanner } from "./inline-diff-accept-banner";
import type { ReportWorkspaceProps, SelectedContext } from "./report-workspace-types";
import { useReportChatSession } from "./use-report-chat-session";

export function ReportWorkspace({
  mode,
  projectId,
  reportId,
  reportContent,
  currentDocumentContent: _currentDocumentContent,
  onContentChange,
  onSectionChange,
  onEditorUpdate,
  onReportContentSaved: _onReportContentSaved,
  onBack,
  backLabel = "Back",
  photos: _photos = [],
  reportStatus,
  onStatusChange,
  onRequestPeerReview,
  onExport,
  exportPdfLoading,
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
}: ReportWorkspaceProps) {
  const { sessionId, initialChatMessages, sessionBootstrapReady } = useReportChatSession(
    projectId,
    reportId,
  );

  const [pendingChange, setPendingChange] = useState<PendingChange | null>(null);
  const [diffContent, setDiffContent] = useState<string | null>(null);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedContexts, setSelectedContexts] = useState<SelectedContext[]>([]);

  const activeSection = selectedContexts.find((c) => c.type === "section");
  const activeSectionId = activeSection ? String(activeSection.id) : undefined;

  const [isChatCollapsed, setIsChatCollapsed] = useState(false);
  const [chatWidth, setChatWidth] = useState(384);

  const [isGeneratingEdit, setIsGeneratingEdit] = useState(false);
  const [inlineDiffRange, setInlineDiffRange] = useState<{ from: number; to: number } | null>(null);
  const [hasUnresolvedEdits, setHasUnresolvedEdits] = useState(false);
  const [appliedPeerSuggestionIds, setAppliedPeerSuggestionIds] = useState<Set<string>>(
    () => new Set(),
  );

  const editorRef = useRef<TiptapEditorHandle | null>(null);
  const [pinnedSelectionContext, setPinnedSelectionContext] = useState<SelectionContext | null>(null);

  const getEditorContext = useCallback(() => {
    if (editorRef.current) {
      const outline = editorRef.current.getDocumentOutlineString();
      const section = editorRef.current.getActiveSection();
      const full = editorRef.current.getFullMarkdown();
      return {
        documentOutline: outline,
        activeSectionMarkdown: section?.markdown ?? "",
        activeSectionHeading: section?.heading ?? "",
        fullReportMarkdown: full,
      };
    }
    const main = reportContent.sections.find((s) => s.id === "main-content");
    return {
      documentOutline: "",
      activeSectionMarkdown: "",
      activeSectionHeading: "",
      fullReportMarkdown: main?.content ?? "",
    };
  }, [reportContent]);

  const handleSelectionChange = useCallback((ctx: SelectionContext | null) => {
    setPinnedSelectionContext(ctx);
  }, []);

  const handleEditorUpdateWithContext = useCallback(
    (newContent: string) => {
      onEditorUpdate?.(newContent);
    },
    [onEditorUpdate],
  );

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
    [reportId, isGeneratingEdit],
  );

  const handleAcceptAllChanges = useCallback(() => {
    if (!editorRef.current) return;
    editorRef.current.resolveAllChanges("accept");
    setInlineDiffRange(null);
  }, []);

  const handleRejectAllChanges = useCallback(() => {
    if (!editorRef.current) return;
    editorRef.current.resolveAllChanges("reject");
    setInlineDiffRange(null);
  }, []);

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
    const { suggestedText, insertAnchor } = suggestion;
    if (!insertAnchor) return;

    const replaceSection =
      typeof insertAnchor === "object" && "replaceSection" in insertAnchor ? insertAnchor.replaceSection : null;

    if (replaceSection) {
      const range = editorRef.current.getRangeForReplaceSection(replaceSection);
      if (!range) {
        console.warn("handleEditSuggestion: could not resolve section:", replaceSection);
        return;
      }

      const bodyContent = stripLeadingHeading(suggestedText);

      const newRange = editorRef.current.applyLibraryDiff(range, bodyContent);
      setInlineDiffRange(newRange);
    } else {
      const pos = editorRef.current.getInsertPositionForAnchor(insertAnchor);
      if (pos != null) {
        const content = (pos > 0 && !suggestedText.startsWith("\n") ? "\n\n" : "") + suggestedText;
        editorRef.current.insertAtPosition(pos, content);
      } else {
        console.warn("handleEditSuggestion: could not resolve insert anchor:", insertAnchor);
      }
    }
  }, []);

  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    if (isSelectionMode) {
      setSelectedContexts([]);
    }
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
        label: `"${selectedText.substring(0, 30)}${selectedText.length > 30 ? "..." : ""}" from ${sectionTitle}`,
        highlightedText: selectedText,
      };

      const exists = selectedContexts.some(
        (c) => c.type === "text" && c.highlightedText === selectedText && c.id === sectionId,
      );

      if (!exists) {
        setSelectedContexts([...selectedContexts, context]);
      }
    }
  };

  return (
    <div className="flex h-[calc(100vh-73px)] overflow-hidden">
      <ReportDocument
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
        exportPdfLoading={exportPdfLoading}
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

      <AIChatSidebar
        projectId={projectId != null ? String(projectId) : undefined}
        reportId={reportId != null ? String(reportId) : undefined}
        sessionId={sessionId}
        sessionBootstrapReady={sessionBootstrapReady}
        initialMessages={initialChatMessages}
        activeSectionId={activeSectionId ? String(activeSectionId) : undefined}
        isCollapsed={isChatCollapsed}
        width={chatWidth}
        onToggleCollapse={() => setIsChatCollapsed(!isChatCollapsed)}
        onResize={setChatWidth}
        onSuggestionAccept={(suggestion) => {
          if (useTiptap && suggestion.sectionId === "main-content") {
            setDiffContent(suggestion.newValue);
          } else {
            setPendingChange({
              messageId: suggestion.messageId,
              sectionId: suggestion.sectionId,
              oldValue: suggestion.oldValue,
              newValue: suggestion.newValue,
              newData: undefined,
              source: suggestion.source as "ai" | "peer-review",
            });
          }
        }}
        onEditSuggestion={handleEditSuggestion}
        getEditorSelectionContext={() => editorRef.current?.getSelectionContext() ?? pinnedSelectionContext ?? null}
        onRequestAIEditWithSelection={requestAIEditWithSelection}
        pinnedSelectionContext={pinnedSelectionContext}
        onClearPinnedSelection={() => setPinnedSelectionContext(null)}
        isGeneratingEdit={isGeneratingEdit}
        selectedContexts={selectedContexts.filter((c) => c.type === "section" || c.type === "photo") as any[]}
        onClearSelectedContexts={() => setSelectedContexts([])}
        onRemoveSelectedContext={removeSelectedContext}
        isSelectionMode={isSelectionMode}
        onToggleSelectionMode={toggleSelectionMode}
        useTiptap={useTiptap}
        onSetDiffContent={setDiffContent}
        getEditorContext={getEditorContext}
      />

      {(inlineDiffRange || hasUnresolvedEdits) && (
        <InlineDiffAcceptBanner onAcceptAll={handleAcceptAllChanges} onRejectAll={handleRejectAllChanges} />
      )}
    </div>
  );
}
