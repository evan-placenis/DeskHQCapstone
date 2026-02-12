'use client';

import ReactMarkdown from 'react-markdown';
import { useState } from "react";
import { Button } from "../ui_components/button";
import { Card } from "../ui_components/card";
import { Badge } from "../ui_components/badge";
import { Separator } from "../ui_components/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui_components/select";
import { EditableText } from "../smart_components/EditableText";
import { RewritableText } from "../smart_components/RewritableText";
import { HighlightableText } from "../smart_components/HighlightableText";
import { PeerReviewPanel } from "../smart_components/PeerReviewPanel";
import { ImageWithFallback } from "../figma/ImageWithFallback";
import { SecureImage } from "../smart_components/SecureImage";
import { TiptapEditor, type TiptapEditorHandle } from "../smart_components/TiptapEditor";
import { PeerReview, ReportContent as ReportContentType } from "@/frontend/types";
import {
  ArrowLeft,
  Download,
  Calendar,
  MapPin,
  Clock,
  AlertCircle,
  CheckCircle2,
  UserCheck,
  Save,
  User,
  Sparkles,
} from "lucide-react";

interface SelectedContext {
  type: "photo" | "section" | "text";
  content: string;
  id?: number | string;
  label: string;
  highlightedText?: string;
}

interface PendingChange {
  messageId: number | string;
  sectionId?: number | string;
  field?: string;
  oldValue: string;
  newValue: string;
  newData?: any;
  changes?: any[];
  stats?: any;
  source: "ai" | "peer-review";
}

interface ReportContentProps {
  mode: "edit" | "peer-review";
  reportContent: ReportContentType;
  onContentChange: (updates: Partial<ReportContentType>) => void;
  onSectionChange: (sectionId: number | string, newContent: string, newData?: any) => void;
  /** Lightweight handler for TiptapEditor keystroke updates — ref + debounced save only, no state cascade */
  onEditorUpdate?: (newContent: string) => void;

  // Header props
  onBack: () => void;
  backLabel?: string;

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

  // Tiptap
  useTiptap?: boolean;

  // Selection mode (for chat context)
  isSelectionMode?: boolean;
  onToggleSelectionMode?: () => void;
  onItemClick?: (context: SelectedContext) => void;
  isItemSelected?: (type: string, id?: number | string) => boolean;
  onTextSelection?: (text: string, sectionId: number | string | undefined, sectionTitle: string) => void;

  // Chat integration
  sessionId?: string | null;
  isChatCollapsed?: boolean;

  // Pending changes (managed by parent for chat integration)
  pendingChange?: PendingChange | null;
  onSetPendingChange?: (change: PendingChange | null) => void;
  diffContent?: string | null;
  onSetDiffContent?: (content: string | null) => void;
  /** Ref to Tiptap editor for client-context AI edit (selection + surrounding) */
  editorRef?: React.RefObject<TiptapEditorHandle | null>;
  /** Called when selection changes in Tiptap (to pin selection when user blurs to chat) */
  onSelectionChange?: (context: import("../smart_components/TiptapEditor").SelectionContext | null) => void;
}

export function ReportContent({
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
  onCompleteReview,
  onOpenRatingModal,
  initialReviewNotes,
  useTiptap = false,
  isSelectionMode = false,
  onToggleSelectionMode,
  onItemClick,
  isItemSelected: isItemSelectedProp,
  onTextSelection,
  sessionId,
  isChatCollapsed = false,
  pendingChange: pendingChangeProp,
  onSetPendingChange,
  diffContent: diffContentProp,
  onSetDiffContent,
  editorRef,
  onSelectionChange,
}: ReportContentProps) {
  // Local state for pending changes if not managed by parent
  const [localPendingChange, setLocalPendingChange] = useState<PendingChange | null>(null);
  const [localDiffContent, setLocalDiffContent] = useState<string | null>(null);
  const [activeHighlightCommentId, setActiveHighlightCommentId] = useState<number | null>(null);

  // Use parent-managed state if provided, otherwise use local state
  const pendingChange = pendingChangeProp !== undefined ? pendingChangeProp : localPendingChange;
  const setPendingChange = onSetPendingChange || setLocalPendingChange;
  const diffContent = diffContentProp !== undefined ? diffContentProp : localDiffContent;
  const setDiffContent = onSetDiffContent || setLocalDiffContent;

  const handleUpdateNestedContent = (
    sectionId: string | number,
    subSectionIndex: number, // -1 means Parent Description
    pointIndex: number | null, // null means updating subsection description
    newValue: string
  ) => {
    const newSections = reportContent.sections.map(sec => {
      if (sec.id !== sectionId) return sec;

      // Update Parent Description
      if (subSectionIndex === -1) {
        return { ...sec, description: newValue };
      }

      // Deep clone subSections to avoid mutation
      if (!sec.subSections) return sec;
      const newSubSections = [...sec.subSections];

      // Clone the specific subsection
      const sub = { ...newSubSections[subSectionIndex] };

      if (pointIndex !== null) {
        // Update bullet point
        if (sub.children && sub.children[pointIndex]) {
          const newChildren = [...sub.children];
          newChildren[pointIndex] = { ...newChildren[pointIndex], point: newValue };
          sub.children = newChildren;
        }
      } else {
        // Update description
        sub.description = newValue;
      }

      newSubSections[subSectionIndex] = sub;

      return { ...sec, subSections: newSubSections };
    });

    onContentChange({ sections: newSections });
  };

  const handleAcceptChange = () => {
    if (!pendingChange) return;

    if (pendingChange.sectionId) {
      onSectionChange(pendingChange.sectionId, pendingChange.newValue, pendingChange.newData);
    }

    setPendingChange(null);
    setDiffContent(null);
  };

  const handleRejectChange = () => {
    setPendingChange(null);
    setDiffContent(null);
  };

  const handleHighlightEdit = (highlightedText: string, sectionId: number | string, newText: string) => {
    const section = reportContent.sections.find(s => s.id === sectionId);
    if (section) {
      setPendingChange({
        messageId: Date.now(),
        sectionId: sectionId,
        oldValue: section.content,
        newValue: section.content.replace(highlightedText, newText),
        source: "peer-review"
      });
    }
  };

  const handleItemClickInternal = (context: SelectedContext) => {
    if (onItemClick) {
      onItemClick(context);
    }
  };

  const isItemSelectedInternal = (type: string, id?: number | string) => {
    if (isItemSelectedProp) {
      return isItemSelectedProp(type, id);
    }
    return false;
  };

  const handleTextSelectionInternal = (text: string, sectionId: number | string | undefined, sectionTitle: string) => {
    if (onTextSelection) {
      onTextSelection(text, sectionId, sectionTitle);
    }
  };

  const handleRequestRewrite = (currentText: string, instructions: string, sectionId?: number | string, field?: string) => {
    if (!sessionId) {
      console.warn("Cannot send rewrite request: session not ready");
      return;
    }

    const rewriteMessage = `Rewrite this text: "${currentText.substring(0, 100)}${currentText.length > 100 ? '...' : ''}"\n\nInstructions: ${instructions}`;
    console.log("Rewrite request:", rewriteMessage);
    // TODO: Integrate with chat when available
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 p-3 sm:p-6 flex-shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="mb-2 sm:mb-3 -ml-2 rounded-lg text-xs sm:text-sm h-8 sm:h-auto"
          onClick={onBack}
        >
          <ArrowLeft className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
          {backLabel}
        </Button>

        <div className="flex flex-col sm:flex-row items-start justify-between gap-3 sm:gap-0">
          <div className="flex-1 min-w-0">
            <h1 className="text-slate-900 mb-2 text-base sm:text-xl truncate">{reportContent.title}</h1>
            <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-slate-600">
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3 sm:w-4 sm:h-4" />
                {reportContent.date}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3 sm:w-4 sm:h-4" />
                {reportContent.location}
              </span>
              <span className="flex items-center gap-1">
                <User className="w-3 h-3 sm:w-4 sm:h-4" />
                {reportContent.engineer}
              </span>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
            <Select value={reportStatus} onValueChange={onStatusChange}>
              <SelectTrigger className="rounded-lg text-xs sm:text-sm h-8 sm:h-10 w-full sm:w-auto">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Draft">Draft</SelectItem>
                <SelectItem value="Under Review">Under Review</SelectItem>
                <SelectItem value="Completed">Completed</SelectItem>
              </SelectContent>
            </Select>
            {mode === "edit" && onRequestPeerReview && (
              <Button
                variant="outline"
                className="rounded-lg text-xs sm:text-sm h-8 sm:h-10"
                onClick={onRequestPeerReview}
              >
                <UserCheck className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
                Request Review
              </Button>
            )}
            {showSaveButton && onSave && (
              <Button
                className="bg-theme-success hover:bg-theme-success-hover rounded-lg text-xs sm:text-sm h-8 sm:h-10"
                onClick={onSave}
              >
                <Save className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
                Save
              </Button>
            )}
            {onExport && (
              <Button
                variant="default"
                className="rounded-lg text-xs sm:text-sm h-8 sm:h-10"
                onClick={onExport}
              >
                <Download className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
                Export PDF
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Report Content - Scrollable */}
      <div className="flex-1 overflow-y-auto">
        <div className={`p-3 sm:p-6 transition-all duration-300 ${isChatCollapsed ? 'lg:max-w-5xl lg:mx-auto' : ''}`}>
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Peer Review Panel - Only show in peer-review mode */}
            {mode === "peer-review" && peerReview && (
              <PeerReviewPanel
                reviewerName={peerReview.assignedToName}
                requestedBy={peerReview.requestedByName}
                requestDate={peerReview.requestDate}
                requestNotes={peerReview.requestNotes}
                comments={peerReview.comments}
                onAddComment={onAddReviewComment || (() => { })}
                onAddHighlightComment={onAddHighlightComment || (() => { })}
                onResolveComment={onResolveComment || (() => { })}
                onHighlightClick={(commentId) => setActiveHighlightCommentId(commentId)}
                onCompleteReview={onCompleteReview || (() => { })}
                onOpenRatingModal={onOpenRatingModal || (() => { })}
                isCompleted={peerReview.status === "completed"}
              />
            )}

            {/* Report Card */}
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
                      <Badge
                        className="rounded-md"
                        variant={reportStatus === "Completed" ? "default" : "secondary"}
                      >
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
                {!useTiptap && pendingChange && (!pendingChange.sectionId || pendingChange.sectionId === 'general-context' || !reportContent.sections.some(s => s.id === pendingChange.sectionId)) && (
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
                      Note: Inline diff is only available when using Tiptap editor. Please use Tiptap mode to see inline diffs.
                    </div>
                  </div>
                )}

                {/* Report Sections */}
                {reportContent.sections.map((section, secIdx) => {
                  const hasSubSections = section.subSections && section.subSections.length > 0;
                  const hasImages = section.images && section.images.length > 0;

                  // Auto-numbering Logic
                  const sectionMatch = section.title.match(/^(\d+)/);
                  const sectionPrefix = sectionMatch ? sectionMatch[1] : (secIdx + 1).toString();
                  let globalPointCounter = 1;

                  return (
                    <div key={section.id} className="mb-8">
                      <h3
                        className={`text-xl sm:text-1xl font-bold text-slate-800 mb-4 cursor-pointer transition-all ${isItemSelectedInternal("section", section.id)
                          ? "text-theme-primary"
                          : isSelectionMode
                            ? "hover:text-theme-primary"
                            : "hover:text-theme-primary"
                          }`}
                        onClick={() => handleItemClickInternal({
                          type: "section",
                          id: section.id,
                          content: section.content,
                          label: section.title
                        })}
                      >
                        {section.title} {isItemSelectedInternal("section", section.id) && <CheckCircle2 className="w-4 h-4 inline ml-1" />}
                      </h3>

                      {!useTiptap && pendingChange && pendingChange.sectionId === section.id ? (
                        <div className="mb-6">
                          <div className="text-sm text-slate-600">
                            Note: Inline diff is only available when using Tiptap editor.
                          </div>
                        </div>
                      ) : hasSubSections ? (
                        // Structured Rendering (Editable & Aligned)
                        <div>
                          {/* Parent Section Description (Editable) */}
                          {section.description && (
                            <div className="mb-6">
                              <EditableText
                                value={section.description}
                                onChange={(val) => handleUpdateNestedContent(section.id, -1, null, val)}
                                multiline
                                markdown={true}
                                className="text-slate-600"
                              />
                            </div>
                          )}

                          {section.subSections!.map((sub, subIdx) => (
                            <div key={subIdx} className="mb-6">
                              {/* Sub Title */}
                              {sub.title !== "General Summary" && sub.title !== "Observed Conditions" && (
                                <h4 className="text-lg font-medium text-slate-800 mb-2">{sub.title}</h4>
                              )}

                              {/* Sub Description (Editable) */}
                              {sub.description && (
                                <div className="mb-4">
                                  <EditableText
                                    value={sub.description}
                                    onChange={(val) => handleUpdateNestedContent(section.id, subIdx, null, val)}
                                    multiline
                                    markdown={true}
                                    className="text-slate-600"
                                  />
                                </div>
                              )}

                              {/* Points (Editable & Aligned) */}
                              <div className="space-y-3 mt-2">
                                {sub.children.map((point, pIdx) => {
                                  const pointHasImages = point.images && point.images.length > 0;
                                  const pointLabel = `${sectionPrefix}.${globalPointCounter++}`;

                                  return (
                                    <div key={pIdx} className={`grid grid-cols-1 ${pointHasImages ? 'md:grid-cols-2 gap-6' : 'gap-4'}`}>
                                      {/* Text Column (Editable) */}
                                      <div className="flex gap-3">
                                        <span className="mt-1 text-slate-900 font-normal min-w-[2rem] select-none">{pointLabel}</span>
                                        <div className="flex-1">
                                          <EditableText
                                            value={point.point}
                                            onChange={(val) => handleUpdateNestedContent(section.id, subIdx, pIdx, val)}
                                            multiline
                                            markdown={true}
                                            className="w-full"
                                          />
                                        </div>
                                      </div>

                                      {/* Images Column */}
                                      {pointHasImages && (
                                        <div className="space-y-4">
                                          {point.images!.map((img: any) => (
                                            <div key={img.imageId || img.id || Math.random()} className="rounded-lg overflow-hidden border border-slate-200 shadow-sm bg-white">
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
                                                  <p className="text-xs text-slate-600 line-clamp-2">
                                                    {img.description || img.caption}
                                                  </p>
                                                </div>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        // Fallback to Old Flattened Rendering
                        <div className={`grid grid-cols-1 gap-6 ${hasImages ? 'sm:grid-cols-2' : ''}`}>
                          {/* Text Content */}
                          <div className={`min-w-0 ${hasImages ? 'md:col-span-2' : ''}`}>
                            {useTiptap && section.id === "main-content" ? (
                              // Use TiptapEditor for main content with inline diff support
                              <TiptapEditor
                                ref={editorRef as React.RefObject<TiptapEditorHandle>}
                                content={section.content || ""}
                                onUpdate={onEditorUpdate || ((newMarkdown) => onSectionChange(section.id, newMarkdown))}
                                editable={mode === "edit" && !isSelectionMode}
                                diffContent={diffContent}
                                onAcceptDiff={() => {
                                  if (diffContent) {
                                    onSectionChange(section.id, diffContent);
                                    setDiffContent(null);
                                  }
                                }}
                                onRejectDiff={() => {
                                  setDiffContent(null);
                                }}
                                onSelectionChange={onSelectionChange}
                              />
                            ) : mode === "peer-review" && peerReview && peerReview.comments ? (
                              <HighlightableText
                                content={section.content}
                                sectionId={section.id}
                                comments={peerReview.comments}
                                onAddHighlightComment={onAddHighlightComment}
                                onAddHighlightEdit={handleHighlightEdit}
                                onHighlightClick={(commentId) => setActiveHighlightCommentId(commentId)}
                                activeCommentId={activeHighlightCommentId}
                                disabled={isSelectionMode}
                                onTextSelection={(text) => handleTextSelectionInternal(text, section.id, section.title)}
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

                          {/* Images Column */}
                          {hasImages && (
                            <div className="space-y-4">
                              {section.images!.map((img: any) => (
                                <div key={img.imageId || img.id || Math.random()} className="rounded-lg overflow-hidden border border-slate-200 shadow-sm bg-white">
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
                                      <p className="text-xs text-slate-600 line-clamp-2">
                                        {img.description || img.caption}
                                      </p>
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
          </div>
        </div>
      </div>
    </div>
  );
}
