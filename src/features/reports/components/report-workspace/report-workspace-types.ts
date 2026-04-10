import type { PeerReview, ReportContent as ReportContentType } from "@/lib/types";

/** Passed to {@link ReportWorkspaceProps.onExport} so the parent can read Tiptap HTML at click time */
export type ReportExportPdfContext = {
  getTiptapHtml: () => string;
};

export interface SelectedContext {
  type: "photo" | "section" | "text";
  content: string;
  id?: number | string;
  label: string;
  highlightedText?: string;
}

export interface ReportWorkspaceProps {
  mode: "edit" | "peer-review";
  projectId?: string | number;
  reportId?: string | number;
  reportContent: ReportContentType;
  /** Current full document content (e.g. markdown) for AI edit replace; used when accepting edits */
  currentDocumentContent?: string;
  onContentChange: (updates: Partial<ReportContentType>) => void;
  onSectionChange: (sectionId: number | string, newContent: string, newData?: unknown) => void;
  /** Lightweight handler for TiptapEditor keystroke updates — ref + debounced save only, no state cascade */
  onEditorUpdate?: (newContent: string) => void;
  /** Called after report content is saved (e.g. so parent can sync lastSavedContentRef) */
  onReportContentSaved?: (content: string) => void;

  onBack: () => void;
  backLabel?: string;

  photos?: Array<{ id: number | string; url: string; caption?: string; section?: string }>;

  reportStatus: string;
  onStatusChange: (status: string) => void;

  onRequestPeerReview?: () => void;
  onExport?: (ctx: ReportExportPdfContext) => void | Promise<void>;
  /** Disables Export PDF and shows loading label */
  exportPdfLoading?: boolean;
  onExportDocx?: (ctx: ReportExportPdfContext) => void | Promise<void>;
  exportDocxLoading?: boolean;
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
  onCompleteReview?: () => void;
  onOpenRatingModal?: () => void;
  initialReviewNotes?: string;

  useTiptap?: boolean;
}
