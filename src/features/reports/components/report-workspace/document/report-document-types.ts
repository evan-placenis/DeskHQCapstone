import type { RefObject } from "react";
import type { PeerReview, ReportContent as ReportContentType } from "@/lib/types";
import type { TiptapEditorHandle } from "../../authoring/tiptap/tiptap-editor";
import type { ReportExportPdfContext } from "../report-workspace-types";

export interface PendingChange {
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

export interface ReportDocumentProps {
  mode: "edit" | "peer-review";
  reportContent: ReportContentType;
  onContentChange: (updates: Partial<ReportContentType>) => void;
  onSectionChange: (sectionId: number | string, newContent: string, newData?: any) => void;
  onEditorUpdate?: (newContent: string) => void;

  onBack: () => void;
  backLabel?: string;

  reportStatus: string;
  onStatusChange: (status: string) => void;

  onRequestPeerReview?: () => void;
  onExport?: (ctx: ReportExportPdfContext) => void | Promise<void>;
  exportPdfLoading?: boolean;
  onSave?: () => void;
  showSaveButton?: boolean;

  peerReview?: PeerReview;
  onAddReviewComment?: (comment: string, type: "issue" | "suggestion" | "comment") => void | Promise<void>;
  onAddHighlightComment?: (
    highlightedText: string,
    sectionId: number | string,
    comment: string,
    type: "issue" | "suggestion" | "comment",
  ) => void | Promise<void | { id: string | number } | null>;
  onResolveComment?: (commentId: number | string) => void | Promise<void>;
  onApplyPeerSuggestion?: (commentId: number | string) => void;
  appliedPeerSuggestionIds?: Set<string>;
  onAppliedPeerSuggestionIdsChange?: (next: Set<string>) => void;
  onCompleteReview?: () => void;
  onOpenRatingModal?: () => void;
  initialReviewNotes?: string;

  useTiptap?: boolean;

  isSelectionMode?: boolean;
  onToggleSelectionMode?: () => void;
  onTextSelection?: (text: string, sectionId: number | string | undefined, sectionTitle: string) => void;

  sessionId?: string | null;
  isChatCollapsed?: boolean;

  pendingChange?: PendingChange | null;
  onSetPendingChange?: (change: PendingChange | null) => void;
  diffContent?: string | null;
  onSetDiffContent?: (content: string | null) => void;
  editorRef?: RefObject<TiptapEditorHandle | null>;
  onSelectionChange?: (context: import("../../authoring/tiptap/tiptap-editor").SelectionContext | null) => void;
  pinnedSelectionRange?: { from: number; to: number } | null;
  onAllDiffChangesResolved?: () => void;
  onHasUnresolvedEditsChange?: (hasEdits: boolean) => void;
}
