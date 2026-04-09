import type { PeerReviewComment } from "@/lib/types";
import type {
  OutlineItem,
  ActiveSectionInfo,
  InsertAnchor,
} from "./section-extractor-utils";

/** Context from the editor for client-side AI edit (selection + markdown + range) */
export interface SelectionContext {
  selection: string;
  markdown: string;
  range: { from: number; to: number };
  surroundingContext: string;
  fullMarkdown: string;
}

export interface TiptapEditorHandle {
  getSelectionContext: () => SelectionContext | null;
  replaceRange: (range: { from: number; to: number }, newMarkdown: string) => void;
  insertAtPosition: (pos: number, markdown: string) => void;
  getInsertPositionForAnchor: (anchor: InsertAnchor) => number | null;
  getRangeForReplaceSection: (heading: string) => { from: number; to: number } | null;
  applyLibraryDiff: (
    range: { from: number; to: number },
    aiGeneratedMarkdown: string,
  ) => { from: number; to: number } | null;
  resolveInlineDiff: (blockStart: number, action: "accept" | "reject") => void;
  resolveAllChanges: (action: "accept" | "reject") => void;
  findRangeForPlainText: (search: string) => { from: number; to: number } | null;
  getDocumentOutline: () => OutlineItem[];
  getDocumentOutlineString: () => string;
  getActiveSection: () => ActiveSectionInfo | null;
  getSectionsByHeading: (headings: string[]) => Record<string, string>;
  getFullMarkdown: () => string;
  /** Serialized HTML for server-side PDF export */
  getHtml: () => string;
  clearSelection: () => void;
}

export interface TiptapEditorProps {
  content: string;
  editable?: boolean;
  onUpdate?: (newContent: string) => void;
  diffContent?: string | null;
  onAcceptDiff?: () => void;
  onRejectDiff?: () => void;
  onSelectionChange?: (context: SelectionContext | null) => void;
  pinnedSelectionRange?: { from: number; to: number } | null;
  onAllDiffChangesResolved?: () => void;
  onHasUnresolvedEditsChange?: (hasEdits: boolean) => void;
  peerReviewMode?: boolean;
  sectionId?: string | number;
  peerReviewComments?: PeerReviewComment[];
  activePeerReviewCommentId?: number | string | null;
  onPeerReviewHighlightComment?: (
    highlightedText: string,
    sectionId: string | number,
    comment: string,
    type: "issue" | "suggestion" | "comment",
  ) => void | Promise<void | { id: string | number } | null>;
  onPeerReviewCommentMarkClick?: (commentId: number | string) => void;
  onApplyPeerSuggestion?: (commentId: number | string) => void;
  appliedPeerSuggestionIds?: Set<string>;
  onAppliedPeerSuggestionIdsChange?: (next: Set<string>) => void;
}
