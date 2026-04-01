"use client";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ImageWithFallback } from "@/components/ui/image-with-fallback";
import { SecureImage } from "@/components/ui/secure-image";
import { EditableText } from "../../presentation/legacy-text/editable-text";
import { RewritableText } from "../../presentation/legacy-text/rewritable-text";
import { TiptapEditor, type TiptapEditorHandle, type SelectionContext } from "../../authoring/tiptap/tiptap-editor";
import type { PeerReview, ReportContent as ReportContentType } from "@/lib/types";
import type { RefObject } from "react";
import { AlertCircle, CheckCircle2, Clock, Sparkles } from "lucide-react";
import type { PendingChange } from "../../report-workspace/document/report-document-types";
import { StructuredSection } from "./structured-section";

type HighlightHandler = (
  highlightedText: string,
  sectionId: number | string,
  comment: string,
  type: "issue" | "suggestion" | "comment",
) => void | Promise<void | { id: string | number } | null>;

export function ReportSectionsList({
  reportStatus,
  mode,
  reportContent,
  onContentChange,
  onSectionChange,
  onEditorUpdate,
  useTiptap,
  peerReview,
  isSelectionMode,
  pendingChange,
  diffContent,
  setDiffContent,
  editorRef,
  onSelectionChange,
  pinnedSelectionRange,
  onAllDiffChangesResolved,
  onHasUnresolvedEditsChange,
  activeHighlightCommentId,
  requestHighlightScroll,
  onAddHighlightComment,
  onApplyPeerSuggestion,
  appliedPeerSuggestionIds,
  onAppliedPeerSuggestionIdsChange,
  handleUpdateNestedContent,
  handleTextSelectionInternal,
  handleRequestRewrite,
}: {
  reportStatus: string;
  mode: "edit" | "peer-review";
  reportContent: ReportContentType;
  onContentChange: (updates: Partial<ReportContentType>) => void;
  onSectionChange: (sectionId: number | string, newContent: string, newData?: unknown) => void;
  onEditorUpdate?: (newContent: string) => void;
  useTiptap: boolean;
  peerReview?: PeerReview;
  isSelectionMode: boolean;
  pendingChange: PendingChange | null;
  diffContent: string | null;
  setDiffContent: (content: string | null) => void;
  editorRef?: RefObject<TiptapEditorHandle | null>;
  onSelectionChange?: (context: SelectionContext | null) => void;
  pinnedSelectionRange?: { from: number; to: number } | null;
  onAllDiffChangesResolved?: () => void;
  onHasUnresolvedEditsChange?: (hasEdits: boolean) => void;
  activeHighlightCommentId: number | string | null;
  requestHighlightScroll: (commentId: number | string) => void;
  onAddHighlightComment?: HighlightHandler;
  onApplyPeerSuggestion?: (commentId: number | string) => void;
  appliedPeerSuggestionIds?: Set<string>;
  onAppliedPeerSuggestionIdsChange?: (next: Set<string>) => void;
  handleUpdateNestedContent: (
    sectionId: string | number,
    subSectionIndex: number,
    pointIndex: number | null,
    newValue: string,
  ) => void;
  handleTextSelectionInternal: (
    text: string,
    sectionId: number | string | undefined,
    sectionTitle: string,
  ) => void;
  handleRequestRewrite: (
    currentText: string,
    instructions: string,
    sectionId?: number | string,
    field?: string,
  ) => void;
}) {
  return (
    <Card className="rounded-xl shadow-sm border-slate-200">
      <div className="p-4 sm:p-8 bg-white space-y-6">
        {/* Report Header Info */}
        <div className="pb-6 border-b border-slate-200">
          <div className="text-xl sm:text-2xl mb-4">
            <EditableText
              value={reportContent.title}
              onChange={(value) => onContentChange({ title: value })}
              textClassName="text-slate-900"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="flex items-center">
              <span className="text-slate-600">Date: </span>
              <div className="ml-1 flex-1">
                <EditableText
                  value={reportContent.date}
                  onChange={(value) => onContentChange({ date: value })}
                  textClassName="text-slate-900"
                />
              </div>
            </div>
            <div className="flex items-center">
              <span className="text-slate-600">Engineer: </span>
              <div className="ml-1 flex-1">
                <EditableText
                  value={reportContent.engineer}
                  onChange={(value) => onContentChange({ engineer: value })}
                  textClassName="text-slate-900"
                />
              </div>
            </div>
            <div className="flex items-center">
              <span className="text-slate-600">Location: </span>
              <div className="ml-1 flex-1">
                <EditableText
                  value={reportContent.location}
                  onChange={(value) => onContentChange({ location: value })}
                  textClassName="text-slate-900"
                />
              </div>
            </div>
            <div>
              <span className="text-slate-600">Status: </span>
              <Badge className="rounded-md" variant={reportStatus === "Completed" ? "default" : "secondary"}>
                {reportStatus === "Draft" && <Clock className="w-3 h-3 mr-1" />}
                {reportStatus === "Under Review" && <AlertCircle className="w-3 h-3 mr-1" />}
                {reportStatus === "Completed" && <CheckCircle2 className="w-3 h-3 mr-1" />}
                {reportStatus}
              </Badge>
            </div>
          </div>
        </div>

        <Separator />

        {/* Global / Fallback Diff View for Pending Changes - Only show if not using Tiptap */}
        {!useTiptap &&
          pendingChange &&
          (!pendingChange.sectionId ||
            pendingChange.sectionId === "general-context" ||
            !reportContent.sections.some((s) => s.id === pendingChange.sectionId)) && (
            <div className="mb-8 p-6 bg-blue-50/50 border border-blue-100 rounded-xl shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-5 h-5 text-blue-600" />
                <span className="font-semibold text-slate-800">Suggested Edit (General)</span>
                {pendingChange.stats && (
                  <Badge variant="outline" className="ml-2 bg-white text-blue-600 border-blue-200">
                    {pendingChange.stats.changeSummary}
                  </Badge>
                )}
              </div>
              <div className="text-sm text-slate-600 p-4 bg-white rounded border">
                Note: Inline diff is only available when using Tiptap editor. Please use Tiptap mode to see inline
                diffs.
              </div>
            </div>
          )}

        {/* Report Sections */}
        {reportContent.sections.map((section, secIdx) => {
          const hasSubSections = section.subSections && section.subSections.length > 0;
          const hasImages = section.images && section.images.length > 0;

          const sectionMatch = section.title.match(/^(\d+)/);
          const sectionPrefix = sectionMatch ? sectionMatch[1] : (secIdx + 1).toString();

          return (
            <div key={section.id} className="mb-8">
              {!useTiptap && pendingChange && pendingChange.sectionId === section.id ? (
                <div className="mb-6">
                  <div className="text-sm text-slate-600">
                    Note: Inline diff is only available when using Tiptap editor.
                  </div>
                </div>
              ) : hasSubSections ? (
                <StructuredSection
                  section={section}
                  sectionPrefix={sectionPrefix}
                  handleUpdateNestedContent={handleUpdateNestedContent}
                />
              ) : (
                <div className={`grid grid-cols-1 gap-6 ${hasImages ? "sm:grid-cols-2" : ""}`}>
                  <div className={`min-w-0 ${hasImages ? "md:col-span-2" : ""}`}>
                    {useTiptap && (section.id === "main-content" || (mode === "peer-review" && peerReview)) ? (
                      <TiptapEditor
                        ref={
                          section.id === "main-content"
                            ? (editorRef as RefObject<TiptapEditorHandle> | undefined)
                            : undefined
                        }
                        content={section.content || ""}
                        onUpdate={onEditorUpdate || ((newMarkdown) => onSectionChange(section.id, newMarkdown))}
                        editable={(mode === "edit" || mode === "peer-review") && !isSelectionMode}
                        diffContent={section.id === "main-content" ? diffContent : undefined}
                        onAcceptDiff={() => {
                          if (diffContent) {
                            onSectionChange(section.id, diffContent);
                            setDiffContent(null);
                          }
                        }}
                        onRejectDiff={() => {
                          setDiffContent(null);
                        }}
                        onSelectionChange={section.id === "main-content" ? onSelectionChange : undefined}
                        pinnedSelectionRange={section.id === "main-content" ? pinnedSelectionRange : undefined}
                        onAllDiffChangesResolved={onAllDiffChangesResolved}
                        onHasUnresolvedEditsChange={onHasUnresolvedEditsChange}
                        peerReviewMode={mode === "peer-review" && !!peerReview}
                        sectionId={section.id}
                        peerReviewComments={peerReview?.comments ?? []}
                        activePeerReviewCommentId={activeHighlightCommentId}
                        onPeerReviewHighlightComment={
                          onAddHighlightComment
                            ? async (text, sid, comment, type) =>
                                await onAddHighlightComment(text, sid, comment, type)
                            : undefined
                        }
                        onPeerReviewCommentMarkClick={(id) => requestHighlightScroll(id)}
                        onApplyPeerSuggestion={section.id === "main-content" ? onApplyPeerSuggestion : undefined}
                        appliedPeerSuggestionIds={appliedPeerSuggestionIds}
                        onAppliedPeerSuggestionIdsChange={onAppliedPeerSuggestionIdsChange}
                      />
                    ) : (
                      <RewritableText
                        value={section.content}
                        onChange={(value) => onSectionChange(section.id, value)}
                        onRequestRewrite={(currentText, instructions) =>
                          handleRequestRewrite(currentText, instructions, section.id, undefined)
                        }
                        multiline
                        markdown={true}
                        disabled={isSelectionMode}
                        onTextSelection={(text) => handleTextSelectionInternal(text, section.id, section.title)}
                      />
                    )}
                  </div>

                  {hasImages && (
                    <div className="space-y-4">
                      {section.images!.map((img: { imageId?: string; id?: string; storagePath?: string; url?: string; description?: string; caption?: string }) => (
                        <div
                          key={img.imageId || img.id || Math.random()}
                          className="rounded-lg overflow-hidden border border-slate-200 shadow-sm bg-white"
                        >
                          {img.storagePath ? (
                            <SecureImage
                              storagePath={img.storagePath}
                              alt={img.description || img.caption || "Report Image"}
                              className="w-full h-48 object-cover"
                            />
                          ) : (
                            <ImageWithFallback
                              src={img.url}
                              alt={img.description || img.caption || "Report Image"}
                              className="w-full h-48 object-cover"
                            />
                          )}
                          {(img.description || img.caption) && (
                            <div className="p-2 border-t border-slate-200 bg-slate-50">
                              <p className="text-xs text-slate-600 line-clamp-2">{img.description || img.caption}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
