"use client";

import { useState, useCallback } from "react";
import { ReportDocumentHeader } from "./report-document-header";
import { ReportPeerReviewSlot } from "../../peer-review/report-peer-review-slot";
import { ReportSectionsList } from "../../generation/sections/report-sections-list";
import { usePeerReviewHighlightScroll } from "../../peer-review/peer-review-scroll-effects";
import type { ReportDocumentProps } from "./report-document-types";

export function ReportDocument({
  mode,
  reportContent,
  onContentChange,
  onSectionChange,
  onEditorUpdate,
  onBack,
  backLabel = "Back",
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
  onApplyPeerSuggestion,
  appliedPeerSuggestionIds,
  onAppliedPeerSuggestionIdsChange,
  onCompleteReview,
  onOpenRatingModal,
  useTiptap = false,
  isSelectionMode = false,
  onTextSelection,
  sessionId,
  isChatCollapsed = false,
  pendingChange: pendingChangeProp,
  onSetPendingChange,
  diffContent: diffContentProp,
  onSetDiffContent,
  editorRef,
  onSelectionChange,
  pinnedSelectionRange,
  onAllDiffChangesResolved,
  onHasUnresolvedEditsChange,
}: ReportDocumentProps) {
  const [localPendingChange] = useState<import("./report-document-types").PendingChange | null>(null);
  const [localDiffContent, setLocalDiffContent] = useState<string | null>(null);

  const { activeHighlightCommentId, requestHighlightScroll } = usePeerReviewHighlightScroll(peerReview?.comments);

  const pendingChange = pendingChangeProp !== undefined ? pendingChangeProp : localPendingChange;
  const diffContent = diffContentProp !== undefined ? diffContentProp : localDiffContent;
  const setDiffContent = onSetDiffContent || setLocalDiffContent;

  const handleUpdateNestedContent = useCallback(
    (
      sectionId: string | number,
      subSectionIndex: number,
      pointIndex: number | null,
      newValue: string,
    ) => {
      const newSections = reportContent.sections.map((sec) => {
        if (sec.id !== sectionId) return sec;

        if (subSectionIndex === -1) {
          return { ...sec, description: newValue };
        }

        if (!sec.subSections) return sec;
        const newSubSections = [...sec.subSections];
        const sub = { ...newSubSections[subSectionIndex] };

        if (pointIndex !== null) {
          if (sub.children && sub.children[pointIndex]) {
            const newChildren = [...sub.children];
            newChildren[pointIndex] = { ...newChildren[pointIndex], point: newValue };
            sub.children = newChildren;
          }
        } else {
          sub.description = newValue;
        }

        newSubSections[subSectionIndex] = sub;

        return { ...sec, subSections: newSubSections };
      });

      onContentChange({ sections: newSections });
    },
    [reportContent.sections, onContentChange],
  );

  const handleTextSelectionInternal = useCallback(
    (text: string, sectionId: number | string | undefined, sectionTitle: string) => {
      if (onTextSelection) {
        onTextSelection(text, sectionId, sectionTitle);
      }
    },
    [onTextSelection],
  );

  const handleRequestRewrite = useCallback(
    (currentText: string, instructions: string, sectionId?: number | string, field?: string) => {
      if (!sessionId) {
        console.warn("Cannot send rewrite request: session not ready");
        return;
      }

      const rewriteMessage = `Rewrite this text: "${currentText.substring(0, 100)}${currentText.length > 100 ? "..." : ""}"\n\nInstructions: ${instructions}`;
      console.log("Rewrite request:", rewriteMessage);
    },
    [sessionId],
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
      <ReportDocumentHeader
        backLabel={backLabel}
        onBack={onBack}
        reportContent={reportContent}
        reportStatus={reportStatus}
        onStatusChange={onStatusChange}
        mode={mode}
        onRequestPeerReview={onRequestPeerReview}
        showSaveButton={showSaveButton}
        onSave={onSave}
        onExport={onExport}
      />

      <div className="flex-1 overflow-y-auto">
        <div className={`p-3 sm:p-6 transition-all duration-300 ${isChatCollapsed ? "lg:max-w-5xl lg:mx-auto" : ""}`}>
          <div className="max-w-4xl mx-auto space-y-6">
            {mode === "peer-review" && peerReview && (
              <ReportPeerReviewSlot
                peerReview={peerReview}
                onAddReviewComment={onAddReviewComment || (() => {})}
                onAddHighlightComment={onAddHighlightComment || (() => {})}
                onResolveComment={onResolveComment || (() => {})}
                onApplyPeerSuggestion={onApplyPeerSuggestion}
                appliedPeerSuggestionIds={appliedPeerSuggestionIds}
                onHighlightClick={requestHighlightScroll}
                onCompleteReview={onCompleteReview || (() => {})}
                onOpenRatingModal={onOpenRatingModal || (() => {})}
              />
            )}

            <ReportSectionsList
              reportStatus={reportStatus}
              mode={mode}
              reportContent={reportContent}
              onContentChange={onContentChange}
              onSectionChange={onSectionChange}
              onEditorUpdate={onEditorUpdate}
              useTiptap={useTiptap}
              peerReview={peerReview}
              isSelectionMode={isSelectionMode}
              pendingChange={pendingChange}
              diffContent={diffContent}
              setDiffContent={setDiffContent}
              editorRef={editorRef}
              onSelectionChange={onSelectionChange}
              pinnedSelectionRange={pinnedSelectionRange}
              onAllDiffChangesResolved={onAllDiffChangesResolved}
              onHasUnresolvedEditsChange={onHasUnresolvedEditsChange}
              activeHighlightCommentId={activeHighlightCommentId}
              requestHighlightScroll={requestHighlightScroll}
              onAddHighlightComment={onAddHighlightComment}
              onApplyPeerSuggestion={onApplyPeerSuggestion}
              appliedPeerSuggestionIds={appliedPeerSuggestionIds}
              onAppliedPeerSuggestionIdsChange={onAppliedPeerSuggestionIdsChange}
              handleUpdateNestedContent={handleUpdateNestedContent}
              handleTextSelectionInternal={handleTextSelectionInternal}
              handleRequestRewrite={handleRequestRewrite}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
